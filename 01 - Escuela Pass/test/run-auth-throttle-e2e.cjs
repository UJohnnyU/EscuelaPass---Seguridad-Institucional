/**
 * Ejecuta solo el spec de throttle con AUTH_THROTTLE_LIMIT=5 antes de cargar Jest,
 * para poder obtener 429 sin romper la suite principal (límite alto en jest-e2e.setup).
 */
const { spawnSync } = require('child_process');
const path = require('path');

process.env.AUTH_THROTTLE_LIMIT = '5';

const root = path.resolve(__dirname, '..');
const jestBin = require.resolve('jest/bin/jest');

const result = spawnSync(
  process.execPath,
  [
    jestBin,
    '--config',
    './test/jest-e2e.json',
    '--testPathPattern',
    'auth-throttle-ip',
    '--runInBand'
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env }
  }
);

process.exit(result.status === null ? 1 : result.status);
