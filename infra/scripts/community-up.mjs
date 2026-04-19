import dotenv from 'dotenv';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const rootDir = process.cwd();
dotenv.config({ path: resolve(rootDir, '.env') });

const heliogramDir = resolve(rootDir, 'apps', 'heliogram');
const serverDir = resolve(heliogramDir, 'backend');
const clientDir = resolve(heliogramDir, 'frontend');
const envPath = resolve(heliogramDir, '.env');
const envExamplePath = resolve(heliogramDir, '.env.example');
const runtimeDir = resolve(heliogramDir, '.runtime');
const composeFilePath = resolve(rootDir, 'docker-compose.yml');
const nativeStatePath = resolve(runtimeDir, 'community-native-state.json');
const backendLogPath = resolve(runtimeDir, 'community-backend.log');
const frontendLogPath = resolve(runtimeDir, 'community-frontend.log');
const isWin = process.platform === 'win32';
const dockerCmd = isWin ? 'docker.exe' : 'docker';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const pythonCmd = isWin
  ? resolve(serverDir, 'venv', 'Scripts', 'python.exe')
  : resolve(serverDir, 'venv', 'bin', 'python');

const VALID_RUN_MODES = new Set(['native', 'docker', 'auto']);

function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true });
}

function clearNativeState() {
  if (existsSync(nativeStatePath)) {
    rmSync(nativeStatePath, { force: true });
  }
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

function writeNativeState(state) {
  ensureRuntimeDir();
  writeFileSync(nativeStatePath, JSON.stringify(state, null, 2), 'utf-8');
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

function getEnvValue(key, envFileValues, fallback = '') {
  if (process.env[key] !== undefined) {
    return String(process.env[key]);
  }
  if (envFileValues[key] !== undefined) {
    return String(envFileValues[key]);
  }
  return fallback;
}

function buildRuntimeEnv(envFileValues) {
  const mergedEnv = { ...process.env };
  for (const [key, value] of Object.entries(envFileValues)) {
    if (mergedEnv[key] === undefined || mergedEnv[key] === '') {
      mergedEnv[key] = String(value);
    }
  }
  return mergedEnv;
}

function ensureCommunityEnv() {
  if (existsSync(envPath)) {
    return;
  }

  if (existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    console.log('[community] apps/heliogram/.env created from .env.example');
    return;
  }

  console.warn('[community] apps/heliogram/.env not found and .env.example is missing.');
}

function writeCommandOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isDockerHubAuthIssue(output) {
  return (
    /auth\.docker\.io/i.test(output) &&
    /(403|forbidden|failed to fetch oauth token|anonymous token)/i.test(output)
  );
}

function isCommandMissing(result) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return (
    result.error?.code === 'ENOENT' ||
    /(not recognized|not found|executable file not found)/i.test(combinedOutput)
  );
}

function runCompose(args, composeEnv) {
  return spawnSync(dockerCmd, ['compose', '-f', composeFilePath, ...args], {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf-8',
    env: composeEnv,
  });
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

function waitForTcp(host, port, timeoutMs = 5000) {
  const startedAt = Date.now();

  return new Promise((resolveReady) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });
      let settled = false;

      const done = (result) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolveReady(result);
      };

      socket.once('connect', () => done(true));
      socket.once('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          done(false);
          return;
        }
        setTimeout(tryConnect, 300);
      });
      socket.setTimeout(1000, () => {
        if (Date.now() - startedAt >= timeoutMs) {
          done(false);
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };

    tryConnect();
  });
}

async function fetchJsonWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, text, data };
  } catch {
    return { ok: false, status: 0, text: '', data: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isBackendHealthy(backendPort) {
  const result = await fetchJsonWithTimeout(`http://127.0.0.1:${backendPort}/api/health/`, 2500);
  if (!result.ok) {
    return false;
  }

  const statusValue = result.data?.status;
  return statusValue === 'ok';
}

async function isFrontendHealthy(frontendPort) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`http://127.0.0.1:${frontendPort}/`, { signal: controller.signal });
    if (!response.ok) {
      return false;
    }
    const html = await response.text();
    return /<div id="root"><\/div>|<div id='root'><\/div>|<div id=root><\/div>/i.test(html);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForHealthCheck(checkFn, timeoutMs, intervalMs = 800) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (await checkFn()) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

function toWindowsShellArg(value) {
  const raw = String(value);
  if (!/[ \t"&()^|<>]/.test(raw)) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

function startDetachedWithLogs(command, args, cwd, logPath, runtimeEnv) {
  ensureRuntimeDir();
  if (isWin) {
    const commandLine = [command, ...args].map((part) => toWindowsShellArg(part)).join(' ');
    const redirectPath = toWindowsShellArg(logPath);
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `${commandLine} >> ${redirectPath} 2>&1`], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: runtimeEnv,
    });
    child.unref();
    return child.pid ?? null;
  }

  const outputFd = openSync(logPath, 'a');
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', outputFd, outputFd],
    windowsHide: true,
    env: runtimeEnv,
  });
  child.unref();
  closeSync(outputFd);
  return child.pid ?? null;
}

function runMigrations(runtimeEnv) {
  console.log('[community] running Django migrations (native mode)...');
  const result = spawnSync(pythonCmd, ['manage.py', 'migrate', '--noinput'], {
    cwd: serverDir,
    stdio: 'pipe',
    encoding: 'utf-8',
    env: runtimeEnv,
  });
  writeCommandOutput(result);
  return (result.status ?? 1) === 0;
}

async function checkNativeDependencies(config) {
  if (!existsSync(pythonCmd)) {
    console.warn(`[community] native dependency missing: python venv not found at ${pythonCmd}`);
    return false;
  }

  if (!existsSync(resolve(clientDir, 'node_modules'))) {
    console.warn('[community] native dependency missing: apps/heliogram/frontend/node_modules not found.');
    console.warn('[community] run: cd apps/heliogram/frontend && npm install');
    return false;
  }

  if (!config.useSqlite) {
    if (!config.dbHost) {
      console.warn('[community] native dependency invalid: DB_HOST is empty while USE_SQLITE=False.');
      return false;
    }

    if (config.dbHost === 'db') {
      console.warn('[community] native dependency invalid: DB_HOST=db is Docker-only.');
      console.warn(
        '[community] set DB_HOST=127.0.0.1 (or PostgreSQL hostname) in apps/heliogram/.env for native mode.',
      );
      return false;
    }

    const reachable = await waitForTcp(config.dbHost, config.dbPort, 4000);
    if (!reachable) {
      console.warn(
        `[community] native dependency failed: PostgreSQL is not reachable at ${config.dbHost}:${config.dbPort}.`,
      );
      return false;
    }
  }

  return true;
}

function loadCommunityConfig() {
  const heliogramEnv = parseEnvFile(envPath);
  const runModeRaw = (process.env.COMMUNITY_RUN_MODE ?? 'native').trim().toLowerCase();
  const runMode = VALID_RUN_MODES.has(runModeRaw) ? runModeRaw : 'native';

  const backendPort = parsePort(
    process.env.COMMUNITY_BACKEND_PORT ?? process.env.HELIO_BACKEND_PORT ?? 8010,
    8010,
  );
  const frontendPort = parsePort(
    process.env.COMMUNITY_FRONTEND_PORT ?? process.env.HELIO_FRONTEND_PORT ?? 5050,
    5050,
  );

  const useSqlite = parseBool(getEnvValue('USE_SQLITE', heliogramEnv, 'True'), true);
  const dbHost = getEnvValue('DB_HOST', heliogramEnv, '127.0.0.1');
  const dbPort = parsePort(getEnvValue('DB_PORT', heliogramEnv, '5432'), 5432);
  const autoMigrate = parseBool(process.env.COMMUNITY_AUTO_MIGRATE ?? 'true', true);

  return {
    runMode,
    backendPort,
    frontendPort,
    useSqlite,
    dbHost,
    dbPort,
    autoMigrate,
    heliogramEnv,
  };
}

async function startNative(config) {
  console.log('[community] starting HelioGram in native mode (backend + frontend)...');

  const dependenciesReady = await checkNativeDependencies(config);
  if (!dependenciesReady) {
    return false;
  }

  const runtimeEnv = buildRuntimeEnv(config.heliogramEnv);

  const previousState = readNativeState();
  let backendPid = null;
  let frontendPid = null;

  const backendHealthyBefore = await isBackendHealthy(config.backendPort);
  if (!backendHealthyBefore) {
    if (config.autoMigrate) {
      const migrateOk = runMigrations(runtimeEnv);
      if (!migrateOk) {
        console.warn('[community] migration failed; native startup aborted.');
        return false;
      }
    }

    backendPid = startDetachedWithLogs(
      pythonCmd,
      ['manage.py', 'runserver', `0.0.0.0:${config.backendPort}`],
      serverDir,
      backendLogPath,
      runtimeEnv,
    );
  }

  const frontendHealthyBefore = await isFrontendHealthy(config.frontendPort);
  if (!frontendHealthyBefore) {
    frontendPid = startDetachedWithLogs(
      npmCmd,
      ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(config.frontendPort), '--strictPort'],
      clientDir,
      frontendLogPath,
      runtimeEnv,
    );
  }

  const backendReady = await waitForHealthCheck(
    () => isBackendHealthy(config.backendPort),
    35000,
    1000,
  );
  const frontendReady = await waitForHealthCheck(
    () => isFrontendHealthy(config.frontendPort),
    45000,
    1200,
  );

  if (!backendReady || !frontendReady) {
    console.warn('[community] native mode failed health checks.');
    console.warn(`[community] backend log: ${backendLogPath}`);
    console.warn(`[community] frontend log: ${frontendLogPath}`);
    return false;
  }

  const startedByScript = !!backendPid || !!frontendPid;
  const adoptedBackendPid = backendPid ?? findListeningPidsByPort(config.backendPort)[0] ?? null;
  const adoptedFrontendPid = frontendPid ?? findListeningPidsByPort(config.frontendPort)[0] ?? null;
  if (startedByScript || previousState || adoptedBackendPid || adoptedFrontendPid) {
    writeNativeState({
      mode: 'native',
      backendPid: adoptedBackendPid ?? previousState?.backendPid ?? null,
      frontendPid: adoptedFrontendPid ?? previousState?.frontendPid ?? null,
      backendPort: config.backendPort,
      frontendPort: config.frontendPort,
      startedAt: previousState?.startedAt ?? new Date().toISOString(),
    });
  }

  console.log(
    `[community] native mode is up (frontend: http://localhost:${config.frontendPort}, backend: http://localhost:${config.backendPort}).`,
  );
  return true;
}

function startDocker(config) {
  console.log('[community] starting HelioGram stack in Docker mode (db + backend + frontend)...');

  const composeEnv = {
    ...process.env,
    HELIO_BACKEND_PORT: String(config.backendPort),
    HELIO_FRONTEND_PORT: String(config.frontendPort),
  };

  let result = runCompose(['up', '-d', '--build'], composeEnv);
  writeCommandOutput(result);
  let status = result.status ?? 1;

  if (status !== 0) {
    const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (isDockerHubAuthIssue(combinedOutput)) {
      console.warn('[community] docker build pull failed (Docker Hub). Trying cached images without --build...');
      result = runCompose(['up', '-d'], composeEnv);
      writeCommandOutput(result);
      status = result.status ?? 1;
    }
  }

  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const commandMissing = isCommandMissing(result);
  const dockerHubIssue = isDockerHubAuthIssue(combinedOutput);

  if (status === 0) {
    clearNativeState();
    console.log(`[community] Docker mode is up on http://localhost:${config.frontendPort}`);
    return { ok: true, dockerHubIssue: false, commandMissing: false, status };
  }

  return { ok: false, dockerHubIssue, commandMissing, status };
}

async function main() {
  ensureCommunityEnv();
  const config = loadCommunityConfig();

  console.log(
    `[community] mode=${config.runMode}, backendPort=${config.backendPort}, frontendPort=${config.frontendPort}, autoMigrate=${config.autoMigrate}`,
  );

  if (config.runMode === 'native') {
    const nativeStarted = await startNative(config);
    if (nativeStarted) {
      return;
    }

    console.warn('[community] native mode startup failed.');
    process.exit(1);
  }

  if (config.runMode === 'docker') {
    const dockerResult = startDocker(config);
    if (dockerResult.ok) {
      return;
    }

    console.warn('[community] Docker mode startup failed.');
    if (dockerResult.commandMissing) {
      console.warn('[community] Docker command is not available on this system.');
    } else if (dockerResult.dockerHubIssue) {
      console.warn('[community] Docker Hub access is blocked or rate-limited in your current network.');
    }
    process.exit(dockerResult.status || 1);
  }

  const dockerResult = startDocker(config);
  if (dockerResult.ok) {
    return;
  }

  console.warn('[community] auto mode: Docker startup failed, trying native mode...');
  if (dockerResult.commandMissing) {
    console.warn('[community] reason: Docker command is not available.');
  } else if (dockerResult.dockerHubIssue) {
    console.warn('[community] reason: Docker Hub access is blocked or rate-limited.');
  }

  const nativeStarted = await startNative(config);
  if (nativeStarted) {
    return;
  }

  console.warn('[community] auto mode failed (Docker and native both failed).');
  console.warn('[community] check runtime logs and dependencies:');
  console.warn(`[community] backend log: ${backendLogPath}`);
  console.warn(`[community] frontend log: ${frontendLogPath}`);
  process.exit(dockerResult.status || 1);
}

await main();
