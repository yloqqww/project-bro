const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const eslintBin = path.join(root, 'apps', 'web', 'node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(
  process.execPath,
  [eslintBin, 'apps/web/src', '--config', 'apps/web/eslint.config.mjs', '--no-cache'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_PATH: path.join(root, 'apps', 'web', 'node_modules'),
    },
  }
);

process.exit(result.status ?? 1);
