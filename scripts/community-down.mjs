import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const heliogramDir = resolve(process.cwd(), 'heliogram');
const runtimeDir = resolve(heliogramDir, '.runtime');
const nativeStatePath = resolve(runtimeDir, 'community-native-state.json');
const isWin = process.platform === 'win32';
const dockerCmd = isWin ? 'docker.exe' : 'docker';

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
  const result = spawnSync(dockerCmd, ['compose', 'down'], {
    cwd: heliogramDir,
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
  const state = readNativeState();
  if (!state) {
    return false;
  }

  const backendPids = state.backendPid
    ? [state.backendPid]
    : findListeningPidsByPort(Number.parseInt(String(state.backendPort ?? ''), 10));
  const frontendPids = state.frontendPid
    ? [state.frontendPid]
    : findListeningPidsByPort(Number.parseInt(String(state.frontendPort ?? ''), 10));

  const backendStopped = backendPids.length > 0
    ? backendPids.some((pid) => stopProcess(pid, 'backend'))
    : false;
  const frontendStopped = frontendPids.length > 0
    ? frontendPids.some((pid) => stopProcess(pid, 'frontend'))
    : false;

  clearNativeState();
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
