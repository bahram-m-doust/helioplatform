import { spawnSync, spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const nodeCmd = process.execPath;

console.log('[dev] preparing community services...');
const communityUp = spawnSync(nodeCmd, ['scripts/community-up.mjs'], {
  stdio: 'inherit',
});

if ((communityUp.status ?? 1) !== 0) {
  console.warn('[dev] continuing with main site only (community stack not started).');
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
