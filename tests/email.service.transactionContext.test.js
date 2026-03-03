#!/usr/bin/env node
const assert = require('assert');
const emailService = require('../src/services/email.service');

async function run() {
  try {
    process.env.NODE_ENV = 'development';
    process.env.SUPERADMIN_EMAIL = 'ops@example.com';

    const queuedContext = { _pendingSideEffects: [] };
    const queuedResult = await emailService.sendEnterpriseInquiryNotification({
      name: 'Jane Smith',
      email: 'jane@example.com',
      firmName: 'Smith Legal',
      phone: '+1-555-0100',
      message: 'Need enterprise onboarding',
      context: queuedContext,
    });

    assert.deepStrictEqual(queuedResult, { success: true, queued: true, messageId: null });
    assert.strictEqual(queuedContext._pendingSideEffects.length, 1);

    const immediateResult = await emailService.sendEnterpriseInquiryNotification({
      name: 'John Doe',
      email: 'john@example.com',
      firmName: 'Doe Legal',
      phone: '+1-555-0101',
      message: 'Need enterprise pricing details',
      context: null,
    });

    assert.strictEqual(immediateResult.success, true);
    assert.strictEqual(immediateResult.console, true);

    console.log('Email service transaction context test passed.');
  } catch (error) {
    console.error('Email service transaction context test failed:', error);
    process.exit(1);
  }
}

run();
