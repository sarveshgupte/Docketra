#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let activeConfig = null;

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../../models/StorageConfiguration.model' || request === '../models/StorageConfiguration.model') {
    return { findOne: () => ({ lean: async () => activeConfig }) };
  }
  if (request === '../../storage/services/TokenEncryption.service' || request === '../storage/services/TokenEncryption.service') {
    return { decrypt: () => 'refresh' };
  }
  if (request === 'googleapis') {
    return { google: { auth: { OAuth2: class { setCredentials() {} } } } };
  }
  if (request === './providers/GoogleDriveProvider') {
    return class GoogleDriveProvider { constructor() { this.providerName = 'google-drive'; } };
  }
  return originalLoad.apply(this, arguments);
};

const { StorageProviderFactory } = require('../src/services/storage/StorageProviderFactory');

async function testFailureWhenMissingActiveConfig() {
  activeConfig = null;
  await assert.rejects(() => StorageProviderFactory.getProvider('FIRM1'), /No active storage configuration/);
  console.log('  ✓ fails when no active storage configuration exists');
}

async function run() {
  console.log('Running storageProviderFactoryGoogleOnly tests...');
  try {
    await testFailureWhenMissingActiveConfig();
    console.log('All storageProviderFactoryGoogleOnly tests passed.');
  } catch (error) {
    console.error('storageProviderFactoryGoogleOnly tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
