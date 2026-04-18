#!/usr/bin/env node
const assert = require('assert');

const servicePath = require.resolve('../src/services/docketSession.service');
const modelPath = require.resolve('../src/models/DocketSession.model');
const auditServicePath = require.resolve('../src/services/auditLog.service');
const docketAuditServicePath = require.resolve('../src/services/docketAudit.service');

const loadService = ({ modelMock, auditMock, docketAuditMock = { logDocketEvent: async () => null } }) => {
  delete require.cache[servicePath];
  require.cache[modelPath] = { exports: modelMock };
  require.cache[auditServicePath] = { exports: auditMock };
  require.cache[docketAuditServicePath] = { exports: docketAuditMock };
  return require(servicePath);
};

async function testStartSessionCreatesSession() {
  const updates = [];
  const creates = [];
  const audits = [];
  const now = new Date('2026-04-18T10:00:00.000Z');

  const modelMock = {
    updateMany: async (query, update) => {
      updates.push({ query, update });
      return { acknowledged: true };
    },
    create: async (payload) => {
      creates.push(payload);
      return { _id: 'sess-1', ...payload };
    },
  };

  const auditMock = {
    logCaseHistory: async (entry) => {
      audits.push(entry);
      return entry;
    },
  };

  const docketSessionService = loadService({ modelMock, auditMock });
  const session = await docketSessionService.startSession({
    docketId: 'DCK-1',
    firmId: 'FIRM-1',
    userId: 'X001',
    userEmail: 'user@example.com',
    now,
  });

  assert.strictEqual(updates.length, 1);
  assert.deepStrictEqual(updates[0].query, {
    docketId: 'DCK-1', firmId: 'FIRM-1', userId: 'X001', isActive: true,
  });
  assert.strictEqual(creates.length, 1);
  assert.strictEqual(session.isActive, true);
  assert.strictEqual(audits.length, 1);
  assert.strictEqual(audits[0].actionType, 'DOCKET_SESSION_STARTED');
}

async function testHeartbeatIncreasesActiveSeconds() {
  const saves = [];

  const modelMock = {
    findOne: async () => ({
      docketId: 'DCK-2',
      firmId: 'FIRM-1',
      userId: 'X002',
      isActive: true,
      activeSeconds: 4,
      lastHeartbeatAt: new Date('2026-04-18T10:00:00.000Z'),
      save: async function save() {
        saves.push({
          activeSeconds: this.activeSeconds,
          lastHeartbeatAt: this.lastHeartbeatAt,
        });
      },
    }),
  };

  const docketSessionService = loadService({ modelMock, auditMock: { logCaseHistory: async () => null } });

  const session = await docketSessionService.heartbeat({
    docketId: 'DCK-2',
    firmId: 'FIRM-1',
    userId: 'X002',
    now: new Date('2026-04-18T10:00:20.000Z'),
  });

  assert.ok(session);
  assert.strictEqual(session.activeSeconds, 24);
  assert.strictEqual(saves.length, 1);
}

async function testEndSessionSetsInactive() {
  const saves = [];
  const audits = [];

  const liveSession = {
    _id: 'sess-2',
    docketId: 'DCK-3',
    firmId: 'FIRM-1',
    userId: 'X003',
    isActive: true,
    activeSeconds: 42,
    startedAt: new Date('2026-04-18T10:00:00.000Z'),
    save: async function save() {
      saves.push({
        isActive: this.isActive,
        endedAt: this.endedAt,
      });
    },
  };

  const modelMock = {
    findOne: async () => liveSession,
  };

  const auditMock = {
    logCaseHistory: async (entry) => {
      audits.push(entry);
      return entry;
    },
  };

  const docketSessionService = loadService({ modelMock, auditMock });

  const session = await docketSessionService.endSession({
    docketId: 'DCK-3',
    firmId: 'FIRM-1',
    userId: 'X003',
    userEmail: 'user3@example.com',
    now: new Date('2026-04-18T10:07:00.000Z'),
  });

  assert.ok(session);
  assert.strictEqual(session.isActive, false);
  assert.ok(session.endedAt instanceof Date);
  assert.strictEqual(saves.length, 1);
  assert.strictEqual(audits.length, 1);
  assert.strictEqual(audits[0].actionType, 'DOCKET_SESSION_ENDED');
  assert.strictEqual(audits[0].metadata.activeSeconds, 42);
}

async function run() {
  try {
    await testStartSessionCreatesSession();
    await testHeartbeatIncreasesActiveSeconds();
    await testEndSessionSetsInactive();
    console.log('Docket session tests passed.');
  } catch (error) {
    console.error('Docket session tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[servicePath];
    delete require.cache[modelPath];
    delete require.cache[auditServicePath];
    delete require.cache[docketAuditServicePath];
  }
}

run();
