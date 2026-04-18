#!/usr/bin/env node
const assert = require('assert');

const servicePath = require.resolve('../src/services/docketAudit.service');
const legacyModelPath = require.resolve('../src/models/DocketAuditLog.model');
const unifiedModelPath = require.resolve('../src/models/DocketAudit.model');

const loadService = ({ legacyModelMock, unifiedModelMock }) => {
  delete require.cache[servicePath];
  require.cache[legacyModelPath] = { exports: legacyModelMock };
  require.cache[unifiedModelPath] = { exports: unifiedModelMock };
  return require(servicePath);
};

async function testLogDocketEventCreatesEntry() {
  const creates = [];
  const service = loadService({
    legacyModelMock: { create: async () => ({}) },
    unifiedModelMock: {
      create: async (docs) => {
        creates.push(docs[0]);
        return docs;
      },
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
  });

  await service.logDocketEvent({
    docketId: 'DCK-100',
    firmId: 'FIRM-100',
    event: 'STATE_CHANGED',
    userId: 'x001',
    userRole: 'admin',
    fromState: 'IN_WB',
    toState: 'IN_PROGRESS',
    metadata: { note: 'assigned' },
  });

  assert.strictEqual(creates.length, 1);
  assert.strictEqual(creates[0].event, 'STATE_CHANGED');
  assert.strictEqual(creates[0].userId, 'X001');
  assert.strictEqual(creates[0].userRole, 'ADMIN');
  assert.ok(typeof creates[0].dedupeKey === 'string' && creates[0].dedupeKey.length > 0);
}

async function testGetDocketTimelineReturnsSortedEvents() {
  const expected = [{ event: 'SESSION_STARTED' }, { event: 'STATE_CHANGED' }];
  let sortArg = null;
  const service = loadService({
    legacyModelMock: { create: async () => ({}) },
    unifiedModelMock: {
      create: async (docs) => docs,
      find: (query) => {
        assert.deepStrictEqual(query, { docketId: 'DCK-200', firmId: 'FIRM-200' });
        return {
          sort: (arg) => {
            sortArg = arg;
            return {
              lean: async () => expected,
            };
          },
        };
      },
    },
  });

  const timeline = await service.getDocketTimeline('DCK-200', 'FIRM-200');
  assert.deepStrictEqual(sortArg, { createdAt: 1 });
  assert.deepStrictEqual(timeline, expected);
}

async function testInvalidEventIsIgnored() {
  const creates = [];
  const service = loadService({
    legacyModelMock: { create: async () => ({}) },
    unifiedModelMock: {
      create: async (docs) => {
        creates.push(docs[0]);
        return docs;
      },
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
  });

  const result = await service.logDocketEvent({
    docketId: 'DCK-300',
    firmId: 'FIRM-300',
    event: null,
  });

  assert.strictEqual(result, null);
  assert.strictEqual(creates.length, 0);
}

async function testQcActionCountIsSinglePerCall() {
  const store = [];
  const countEvents = (eventName) => store.filter((entry) => entry.event === eventName).length;
  const service = loadService({
    legacyModelMock: { create: async () => ({}) },
    unifiedModelMock: {
      create: async (docs) => {
        store.push(...docs);
        return docs;
      },
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
  });

  await service.logDocketEvent({
    docketId: 'DCK-400',
    firmId: 'FIRM-400',
    event: 'QC_ACTION',
    userId: 'X400',
    metadata: { comment: 'ok', source: 'qcDecision' },
  });

  assert.strictEqual(countEvents('QC_ACTION'), 1);
}

async function run() {
  try {
    await testLogDocketEventCreatesEntry();
    await testGetDocketTimelineReturnsSortedEvents();
    await testInvalidEventIsIgnored();
    await testQcActionCountIsSinglePerCall();
    console.log('Docket audit tests passed.');
  } catch (error) {
    console.error('Docket audit tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[servicePath];
    delete require.cache[legacyModelPath];
    delete require.cache[unifiedModelPath];
  }
}

run();
