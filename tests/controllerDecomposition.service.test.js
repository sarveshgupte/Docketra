#!/usr/bin/env node
const assert = require('assert');

const {
  normalizeFirmSettings,
  normalizeWorkSettings,
  resetUserToInvitedState,
} = require('../src/services/adminController.service');
const {
  normalizeAdminLifecycleStatus,
  isAdminDisabledStatus,
  isAdminCurrentlyLocked,
  resolveSessionQuery,
} = require('../src/services/superadminLifecycle.service');

async function runTests() {
  console.log('Running controller decomposition service tests...');

  {
    const normalized = normalizeFirmSettings({
      slaDefaultDays: -1,
      workloadThreshold: 0,
      enableBulkActions: false,
      brandLogoUrl: '  logo.png  ',
    });
    assert.strictEqual(normalized.slaDefaultDays, 3);
    assert.strictEqual(normalized.workloadThreshold, 15);
    assert.strictEqual(normalized.enableBulkActions, false);
    assert.strictEqual(normalized.brandLogoUrl, 'logo.png');
    console.log('✅ normalizeFirmSettings applies defaults safely');
  }

  {
    const normalized = normalizeWorkSettings({
      assignmentStrategy: 'balanced',
      statusWorkflowMode: 'invalid',
      highPrioritySlaDays: -1,
    });
    assert.strictEqual(normalized.assignmentStrategy, 'balanced');
    assert.strictEqual(normalized.statusWorkflowMode, 'flexible');
    assert.strictEqual(normalized.highPrioritySlaDays, 1);
    console.log('✅ normalizeWorkSettings preserves contract defaults');
  }

  {
    const user = {};
    resetUserToInvitedState(user, {
      tokenHash: 'hash',
      tokenExpiry: new Date('2030-01-01T00:00:00.000Z'),
      inviteSentAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    assert.strictEqual(user.inviteTokenHash, 'hash');
    assert.strictEqual(user.mustSetPassword, true);
    assert.strictEqual(user.status, 'invited');
    assert.strictEqual(user.isActive, false);
    console.log('✅ resetUserToInvitedState sets expected lifecycle flags');
  }

  {
    assert.strictEqual(normalizeAdminLifecycleStatus(' suspended '), 'disabled');
    assert.strictEqual(normalizeAdminLifecycleStatus('ACTIVE'), 'active');
    assert.strictEqual(isAdminDisabledStatus('disabled'), true);
    assert.strictEqual(isAdminDisabledStatus('active'), false);
    assert.strictEqual(isAdminCurrentlyLocked({ lockUntil: new Date(Date.now() + 60_000) }), true);
    assert.strictEqual(isAdminCurrentlyLocked({ lockUntil: new Date(Date.now() - 60_000) }), false);
    console.log('✅ superadmin lifecycle normalization helpers are stable');
  }

  {
    const sessionMarker = {};
    const query = {
      _session: null,
      session(value) {
        this._session = value;
        return this;
      },
      exec() {
        return Promise.resolve({ ok: true, session: this._session });
      },
    };
    const result = await resolveSessionQuery(query, sessionMarker);
    assert.deepStrictEqual(result, { ok: true, session: sessionMarker });
    console.log('✅ resolveSessionQuery preserves session-aware query behavior');
  }

  console.log('All controller decomposition service tests passed.');
  process.exit(0);
}

runTests().catch((error) => {
  console.error('❌ controller decomposition service tests failed');
  console.error(error);
  process.exit(1);
});
