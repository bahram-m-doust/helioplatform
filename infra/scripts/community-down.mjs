import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const heliogramDir = resolve(rootDir, 'apps', 'heliogram');
const composeFilePath = resolve(rootDir, 'docker-compose.yml');
const envPath = resolve(heliogramDir, '.env');
const runtimeDir = resolve(heliogramDir, '.runtime');
const nativeStatePath = resolve(runtimeDir, 'community-native-state.json');
const isWin = process.platform === 'win32';
const dockerCmd = isWin ? 'docker.exe' : 'docker';

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return fallback;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf-8');
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }

  return entries;
}

function readNativeState() {
  if (!existsSync(nativeStatePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(nativeStatePath, 'utf-8'));
  } catch {
    return null;
  }
}

function clearNativeState() {
  if (existsSync(nativeStatePath)) {
    rmSync(nativeStatePath, { force: true });
  }
}

function stopProcess(pid, label) {
  if (!pid || !Number.isInteger(pid)) {
    return true;
  }

  if (isWin) {
    const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const notFound = /(not found|no running instance|not recognized|could not be terminated)/i.test(output);

    if ((result.status ?? 1) === 0 || notFound) {
      console.log(`[community] stopped native ${label} process (pid=${pid}).`);
      return true;
    }

    if (output.trim()) {
      console.warn(output.trim());
    }
    console.warn(`[community] failed to stop native ${label} process (pid=${pid}).`);
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[community] stopped native ${label} process (pid=${pid}).`);
    return true;
  } catch {
    return false;
  }
}

function findListeningPidsByPort(port) {
  if (!port || !Number.isInteger(port)) {
    return [];
  }

  if (isWin) {
    const result = spawnSync('netstat.exe', ['-ano', '-p', 'tcp'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const pids = new Set();
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || !/LISTENING/i.test(line)) {
        continue;
      }
      if (!line.includes(`:${port}`)) {
        continue;
      }
      const parts = line.split(/\s+/);
      const pid = Number.parseInt(parts[parts.length - 1] ?? '', 10);
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    return [...pids];
  }

  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  const pids = new Set();
  for (const token of (result.stdout ?? '').split(/\r?\n/)) {
    const pid = Number.parseInt(token.trim(), 10);
    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function stopDocker() {
  const result = spawnSync(dockerCmd, ['compose', '-f', composeFilePath, 'down'], {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const commandMissing =
    result.error?.code === 'ENOENT' || /(not recognized|not found|executable file not found)/i.test(output);

  if ((result.status ?? 1) === 0) {
    console.log('[community] Docker stack stopped.');
    return true;
  }

  if (commandMissing) {
    console.warn('[community] Docker command is not available. skipped Docker shutdown.');
    return false;
  }

  console.warn('[community] Docker stack stop failed.');
  return false;
}

function stopNativeFromState() {
  const envValues = parseEnvFile(envPath);
  const fallbackBackendPort = parsePort(
    process.env.COMMUNITY_BACKEND_PORT ?? process.env.HELIO_BACKEND_PORT ?? envValues.HELIO_BACKEND_PORT ?? 8010,
    8010,
  );
  const fallbackFrontendPort = parsePort(
    process.env.COMMUNITY_FRONTEND_PORT ?? process.env.HELIO_FRONTEND_PORT ?? envValues.HELIO_FRONTEND_PORT ?? 5050,
    5050,
  );

  const state = readNativeState();
  const backendPort = state ? Number.parseInt(String(state.backendPort ?? ''), 10) : fallbackBackendPort;
  const frontendPort = state ? Number.parseInt(String(state.frontendPort ?? ''), 10) : fallbackFrontendPort;

  const backendPids = state?.backendPid ? [state.backendPid] : findListeningPidsByPort(backendPort);
  const frontendPids = state?.frontendPid ? [state.frontendPid] : findListeningPidsByPort(frontendPort);

  const backendStopped = backendPids.length > 0
    ? backendPids.some((pid) => stopProcess(pid, 'backend'))
    : false;
  const frontendStopped = frontendPids.length > 0
    ? frontendPids.some((pid) => stopProcess(pid, 'frontend'))
    : false;

  clearNativeState();
  if (!state && !backendStopped && !frontendStopped) {
    console.log('[community] native state not found and no process was listening on configured ports.');
  }
  return backendStopped || frontendStopped;
}

function main() {
  console.log('[community] stopping HelioGram services...');

  const nativeStopped = stopNativeFromState();
  const dockerStopped = stopDocker();

  if (!nativeStopped && !dockerStopped) {
    console.warn('[community] nothing confirmed as stopped. services may already be down.');
    return;
  }

  console.log('[community] stop sequence completed.');
}

main();
