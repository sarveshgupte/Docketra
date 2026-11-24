#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getMimeType, sanitizeFilename, getExtension, ensureDirectoryExists } = require('../src/utils/fileUtils');
const { cleanupTempFile, isUnderAllowedRoot } = require('../src/utils/tempFile');
const { cleanupStaleTmpUploads } = require('../src/utils/cleanupTmpUploads');

function testGetMimeType() {
  console.log('Running testGetMimeType...');
  assert.strictEqual(getMimeType('document.pdf'), 'application/pdf');
  assert.strictEqual(getMimeType('image.jpg'), 'image/jpeg');
  assert.strictEqual(getMimeType('image.jpeg'), 'image/jpeg');
  assert.strictEqual(getMimeType('image.png'), 'image/png');
  assert.strictEqual(getMimeType('image.gif'), 'image/gif');
  assert.strictEqual(getMimeType('document.doc'), 'application/msword');
  assert.strictEqual(getMimeType('document.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.strictEqual(getMimeType('spreadsheet.xls'), 'application/vnd.ms-excel');
  assert.strictEqual(getMimeType('spreadsheet.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.strictEqual(getMimeType('text.txt'), 'text/plain');
  assert.strictEqual(getMimeType('data.csv'), 'text/csv');
  assert.strictEqual(getMimeType('email.eml'), 'message/rfc822');
  assert.strictEqual(getMimeType('outlook.msg'), 'application/vnd.ms-outlook');

  // Case insensitivity
  assert.strictEqual(getMimeType('DOCUMENT.PDF'), 'application/pdf');
  assert.strictEqual(getMimeType('image.JPG'), 'image/jpeg');

  // Unknown extensions
  assert.strictEqual(getMimeType('unknown.xyz'), 'application/octet-stream');
  assert.strictEqual(getMimeType('no_extension'), 'application/octet-stream');
  console.log('testGetMimeType passed.');
}

function testSanitizeFilename() {
  console.log('Running testSanitizeFilename...');
  assert.strictEqual(sanitizeFilename('normal_file.txt'), 'normal_file.txt');
  assert.strictEqual(sanitizeFilename('file\nwith\rnewlines\tand\ttabs.txt'), 'filewithnewlinesandtabs.txt');
  assert.strictEqual(sanitizeFilename('file"with\'quotes.txt'), 'filewithquotes.txt');
  assert.strictEqual(sanitizeFilename('file\x07with\x08bell.txt'), 'filewithbell.txt');
  assert.strictEqual(sanitizeFilename('  spaced file.txt  '), 'spaced file.txt');

  const longName = 'a'.repeat(300) + '.txt';
  const expectedLongName = ('a'.repeat(300) + '.txt').substring(0, 255);
  assert.strictEqual(sanitizeFilename(longName), expectedLongName);

  assert.strictEqual(sanitizeFilename(null), 'download');
  assert.strictEqual(sanitizeFilename(undefined), 'download');
  assert.strictEqual(sanitizeFilename(''), 'download');
  console.log('testSanitizeFilename passed.');
}

function testGetExtension() {
  console.log('Running testGetExtension...');
  assert.strictEqual(getExtension('file.txt'), 'txt');
  assert.strictEqual(getExtension('image.png'), 'png');
  assert.strictEqual(getExtension('archive.tar.gz'), 'gz');
  assert.strictEqual(getExtension('no_extension'), '');
  assert.strictEqual(getExtension(null), '');
  assert.strictEqual(getExtension(undefined), '');
  assert.strictEqual(getExtension(''), '');
  console.log('testGetExtension passed.');
}

async function testEnsureDirectoryExists() {
  console.log('Running testEnsureDirectoryExists...');

  const originalMkdir = fs.promises.mkdir;

  try {
    let mkdirCalled = false;
    let mkdirPath = null;
    let mkdirOptions = null;

    fs.promises.mkdir = async (dir, options) => {
      mkdirCalled = true;
      mkdirPath = dir;
      mkdirOptions = options;
      return Promise.resolve();
    };

    await ensureDirectoryExists('/new/dir');
    assert.strictEqual(mkdirCalled, true, 'fs.promises.mkdir should be called');
    assert.strictEqual(mkdirPath, '/new/dir');
    assert.deepStrictEqual(mkdirOptions, { recursive: true });

    console.log('testEnsureDirectoryExists passed.');
  } finally {
    // Restore original functions
    fs.promises.mkdir = originalMkdir;
  }
}

async function testCleanupTempFile() {
  console.log('Running testCleanupTempFile (hardening checks)...');

  // 1. Rejects invalid inputs
  assert.strictEqual(await cleanupTempFile(null), false);
  assert.strictEqual(await cleanupTempFile(''), false);
  assert.strictEqual(await cleanupTempFile(123), false);

  // 2. Refuses to delete files outside allowed roots (e.g. project files)
  const projectFile = path.resolve(__dirname, '../package.json');
  assert.strictEqual(isUnderAllowedRoot(projectFile), false);
  assert.strictEqual(await cleanupTempFile(projectFile), false);
  // Verify package.json still exists
  assert.strictEqual(fs.existsSync(projectFile), true);

  // 3. Allows valid temp root paths
  const tempFilePath = path.join(os.tmpdir(), `docketra-test-${Date.now()}.tmp`);
  assert.strictEqual(isUnderAllowedRoot(tempFilePath), true);

  // Create real temp file and verify cleanup
  fs.writeFileSync(tempFilePath, 'temporary content');
  assert.strictEqual(fs.existsSync(tempFilePath), true);
  const deleted = await cleanupTempFile(tempFilePath);
  assert.strictEqual(deleted, true);
  assert.strictEqual(fs.existsSync(tempFilePath), false);

  // 4. Handles already deleted or non-existent file cleanly
  const nonExistent = path.join(os.tmpdir(), `docketra-missing-${Date.now()}.tmp`);
  assert.strictEqual(await cleanupTempFile(nonExistent), false);

  console.log('testCleanupTempFile passed.');
}

async function testCleanupStaleTmpUploads() {
  console.log('Running testCleanupStaleTmpUploads...');
  const tmpUploadsDir = path.resolve(__dirname, '../uploads/tmp');
  fs.mkdirSync(tmpUploadsDir, { recursive: true });

  const staleFile = path.join(tmpUploadsDir, `stale-${Date.now()}.tmp`);
  fs.writeFileSync(staleFile, 'stale content');

  // Set file mtime to 2 days ago
  const twoDaysAgo = (Date.now() - (48 * 60 * 60 * 1000)) / 1000;
  fs.utimesSync(staleFile, twoDaysAgo, twoDaysAgo);

  const deletedCount = await cleanupStaleTmpUploads(24 * 60 * 60 * 1000);
  assert.strictEqual(deletedCount >= 1, true, 'Should delete stale file');
  assert.strictEqual(fs.existsSync(staleFile), false, 'Stale file should no longer exist');

  console.log('testCleanupStaleTmpUploads passed.');
}

async function run() {
  try {
    testGetMimeType();
    testSanitizeFilename();
    testGetExtension();
    await testEnsureDirectoryExists();
    await testCleanupTempFile();
    await testCleanupStaleTmpUploads();
    console.log('All fileUtils tests passed.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
