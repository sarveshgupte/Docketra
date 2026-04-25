const assert = require('assert');
const { execSync } = require('child_process');

const runScan = (pattern, target) => {
  try {
    const output = execSync(`rg -n "${pattern}" ${target}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return output.trim();
  } catch (error) {
    return '';
  }
};

const run = () => {
  const markers = [
    { pattern: 'DOCKET_DEBUG', target: 'src ui/src' },
    { pattern: 'ACTION_VISIBILITY_DEBUG', target: 'src ui/src' },
    { pattern: "console\\.log\\('API response'", target: 'ui/src' },
  ];

  markers.forEach(({ pattern, target }) => {
    const matches = runScan(pattern, target);
    assert.strictEqual(matches, '', `Forbidden marker found for pattern: ${pattern}\n${matches}`);
  });

  console.log('debugMarkerScan.test.js passed');
};

try {
  run();
} catch (error) {
  console.error('debugMarkerScan.test.js failed', error);
  process.exit(1);
}
