const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectMarkdownFiles,
  normalizeTarget,
  isExternalLink,
  isIgnoredMarkdownFile,
} = require('../scripts/check-markdown-links');

function mkDir(parent, name) {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

(function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-check-'));

  fs.writeFileSync(path.join(tmpRoot, 'README.md'), '# readme');
  mkDir(tmpRoot, 'docs');
  fs.writeFileSync(path.join(tmpRoot, 'docs', 'guide.md'), '# guide');

  mkDir(tmpRoot, 'node_modules');
  fs.writeFileSync(path.join(tmpRoot, 'node_modules', 'ignored.md'), '# ignored');

  mkDir(tmpRoot, '.git');
  fs.writeFileSync(path.join(tmpRoot, '.git', 'ignored.md'), '# ignored');

  mkDir(tmpRoot, 'dist');
  fs.writeFileSync(path.join(tmpRoot, 'dist', 'ignored.md'), '# ignored');

  const files = collectMarkdownFiles(tmpRoot, [], tmpRoot).sort();

  assert.deepStrictEqual(files, ['README.md', 'docs/guide.md']);

  assert.strictEqual(normalizeTarget('../README.md#section?a=1'), '../README.md');
  assert.strictEqual(isExternalLink('https://example.com'), true);
  assert.strictEqual(isExternalLink('../local.md'), false);
  assert.strictEqual(isIgnoredMarkdownFile('docs/archive/test.md'), true);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('checkMarkdownLinks.test.js passed');
})();
