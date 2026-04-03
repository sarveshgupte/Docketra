#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMimeType, sanitizeFilename, getExtension, ensureDirectoryExists } = require('../src/utils/fileUtils');

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

async function run() {
  try {
    testGetMimeType();
    testSanitizeFilename();
    testGetExtension();
    await testEnsureDirectoryExists();
    console.log('All fileUtils tests passed.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
