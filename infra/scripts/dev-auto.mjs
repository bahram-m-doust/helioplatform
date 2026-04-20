import { spawnSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const isWin = process.platform === 'win32';
const nodeCmd = process.execPath;
const rootDir = process.cwd();
const communityUpScript = resolve(rootDir, 'infra', 'scripts', 'community-up.mjs');
const agentsUpScript = resolve(rootDir, 'infra', 'scripts', 'agents-up.mjs');

console.log('[dev] preparing community services...');
const communityUp = spawnSync(nodeCmd, [communityUpScript], {
  stdio: 'inherit',
});

if ((communityUp.status ?? 1) !== 0) {
  console.warn('[dev] continuing with main site only (community stack not started).');
}

console.log('[dev] preparing agent microservices (image-generator, video-generator)...');
const agentsUp = spawnSync(nodeCmd, [agentsUpScript], { stdio: 'inherit' });
if ((agentsUp.status ?? 1) !== 0) {
  console.warn('[dev] continuing with main site only (agent microservices not started).');
}

console.log('[dev] starting main site on http://localhost:4000');
const siteDev = isWin
  ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev:site'], {
      stdio: 'inherit',
    })
  : spawn('npm', ['run', 'dev:site'], {
      stdio: 'inherit',
    });

siteDev.on('exit', (code) => {
  process.exit(code ?? 0);
});
