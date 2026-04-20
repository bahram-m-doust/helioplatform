import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const isWin = process.platform === 'win32';

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const entries = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf('=');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function buildAgentEnv() {
  const envFile = parseEnvFile(resolve(rootDir, '.env'));
  const merged = { ...process.env };
  // Env file keys fill in only when not already present in the shell.
  for (const [key, value] of Object.entries(envFile)) {
    if (merged[key] === undefined || merged[key] === '') {
      merged[key] = value;
    }
  }
  // Normalize the canonical names the FastAPI services read so that a
  // Vite-style `VITE_*` value in the shared .env still works.
  if (!merged.OPENROUTER_API_KEY && merged.VITE_OPENROUTER_API_KEY) {
    merged.OPENROUTER_API_KEY = merged.VITE_OPENROUTER_API_KEY;
  }
  if (!merged.REPLICATE_API_TOKEN && merged.VITE_REPLICATE_API_TOKEN) {
    merged.REPLICATE_API_TOKEN = merged.VITE_REPLICATE_API_TOKEN;
  }
  if (!merged.REPLICATE_IMAGE_MODEL && merged.VITE_REPLICATE_IMAGE_MODEL) {
    merged.REPLICATE_IMAGE_MODEL = merged.VITE_REPLICATE_IMAGE_MODEL;
  }
  if (!merged.REPLICATE_VIDEO_MODEL && merged.VITE_REPLICATE_VIDEO_MODEL) {
    merged.REPLICATE_VIDEO_MODEL = merged.VITE_REPLICATE_VIDEO_MODEL;
  }
  if (!merged.OPENROUTER_MODEL && merged.VITE_OPENROUTER_MODEL) {
    merged.OPENROUTER_MODEL = merged.VITE_OPENROUTER_MODEL;
  }
  return merged;
}

const AGENT_ENV = buildAgentEnv();

const agentsDir = resolve(rootDir, 'agents');
const venvDir = resolve(agentsDir, '.venv');
const runtimeDir = resolve(agentsDir, '.runtime');
const venvPython = isWin
  ? resolve(venvDir, 'Scripts', 'python.exe')
  : resolve(venvDir, 'bin', 'python');

const AGENTS = [
  {
    name: 'image-generator',
    cwd: resolve(agentsDir, 'image-generator', 'backend'),
    port: Number.parseInt(process.env.IMAGE_AGENT_PORT ?? '8020', 10) || 8020,
    logFile: resolve(runtimeDir, 'image-generator.log'),
  },
  {
    name: 'video-generator',
    cwd: resolve(agentsDir, 'video-generator', 'backend'),
    port: Number.parseInt(process.env.VIDEO_AGENT_PORT ?? '8030', 10) || 8030,
    logFile: resolve(runtimeDir, 'video-generator.log'),
  },
  {
    name: 'storyteller',
    cwd: resolve(agentsDir, 'storyteller', 'backend'),
    port: Number.parseInt(process.env.STORYTELLER_AGENT_PORT ?? '8040', 10) || 8040,
    logFile: resolve(runtimeDir, 'storyteller.log'),
  },
  {
    name: 'campaign-maker',
    cwd: resolve(agentsDir, 'campaign-maker', 'backend'),
    port: Number.parseInt(process.env.CAMPAIGN_MAKER_AGENT_PORT ?? '8050', 10) || 8050,
    logFile: resolve(runtimeDir, 'campaign-maker.log'),
  },
];

function log(message) {
  console.log(`[agents] ${message}`);
}

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true });
}

function ensureVenv() {
  if (existsSync(venvPython)) {
    return true;
  }

  log('creating Python venv at agents/.venv ...');
  const result = spawnSync('python', ['-m', 'venv', venvDir], {
    stdio: 'inherit',
  });
  if ((result.status ?? 1) !== 0 || !existsSync(venvPython)) {
    console.error('[agents] failed to create Python venv (is `python` on PATH and >=3.10?).');
    return false;
  }
  return true;
}

function ensureRequirements() {
  const check = spawnSync(
    venvPython,
    ['-c', 'import fastapi, uvicorn, pydantic'],
    { stdio: 'ignore' },
  );
  if ((check.status ?? 1) === 0) {
    return true;
  }

  log('installing FastAPI + uvicorn + pydantic into agents/.venv ...');
  const install = spawnSync(
    venvPython,
    [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--quiet',
      'fastapi>=0.115.0,<1',
      'uvicorn[standard]>=0.32.0,<1',
      'pydantic>=2.9,<3',
    ],
    { stdio: 'inherit' },
  );
  if ((install.status ?? 1) !== 0) {
    console.error('[agents] pip install failed.');
    return false;
  }
  return true;
}

function isPortListening(port) {
  return new Promise((done) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      done(result);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function waitForHealth(agent, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${agent.port}/health`);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data && data.status === 'ok') {
          return true;
        }
      }
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

function startDetached(agent) {
  ensureRuntimeDir();

  const args = [
    '-m',
    'uvicorn',
    'app.main:app',
    '--host',
    '0.0.0.0',
    '--port',
    String(agent.port),
  ];

  if (isWin) {
    const toArg = (value) => {
      const raw = String(value);
      if (!/[ \t"&()^|<>]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const commandLine = [venvPython, ...args].map(toArg).join(' ');
    const redirect = toArg(agent.logFile);
    const child = spawn(
      'cmd.exe',
      ['/d', '/s', '/c', `${commandLine} >> ${redirect} 2>&1`],
      {
        cwd: agent.cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: AGENT_ENV,
      },
    );
    child.unref();
    return child.pid ?? null;
  }

  const fd = openSync(agent.logFile, 'a');
  const child = spawn(venvPython, args, {
    cwd: agent.cwd,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: AGENT_ENV,
  });
  child.unref();
  closeSync(fd);
  return child.pid ?? null;
}

async function startAgent(agent) {
  const alreadyUp = await isPortListening(agent.port);
  if (alreadyUp) {
    const healthy = await waitForHealth(agent, 2000);
    if (healthy) {
      log(`${agent.name} already running on :${agent.port}`);
      return true;
    }
    log(`${agent.name} port :${agent.port} is busy but not healthy; assuming another process.`);
    return false;
  }

  const pid = startDetached(agent);
  if (!pid) {
    console.error(`[agents] failed to spawn ${agent.name}.`);
    return false;
  }

  const ready = await waitForHealth(agent, 25000);
  if (!ready) {
    console.warn(`[agents] ${agent.name} failed health check. See ${agent.logFile}`);
    return false;
  }

  log(`${agent.name} up on http://localhost:${agent.port} (pid ${pid})`);
  return true;
}

async function main() {
  if (!ensureVenv()) process.exit(1);
  if (!ensureRequirements()) process.exit(1);

  const results = await Promise.all(AGENTS.map((a) => startAgent(a)));
  const failures = results.filter((ok) => !ok).length;
  if (failures > 0) {
    console.warn(
      `[agents] ${failures}/${AGENTS.length} agent(s) did not become healthy. Logs in ${runtimeDir}`,
    );
    // Do not hard-exit: main site is still useful without one agent.
  }
}

await main();
