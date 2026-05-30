const assert = require('assert');

const serviceModulePath = require.resolve('../src/services/caseQuery.service');
const narrativeModulePath = require.resolve('../src/services/commentHistoryNarrativeStorage.service');
const docketNarrativeModulePath = require.resolve('../src/services/docketNarrativeStorage.service');

const auditLogModulePath = require.resolve('../src/services/auditLog.service');

delete require.cache[serviceModulePath];
delete require.cache[narrativeModulePath];
delete require.cache[docketNarrativeModulePath];
delete require.cache[auditLogModulePath];

require.cache[auditLogModulePath] = {
  id: auditLogModulePath,
  filename: auditLogModulePath,
  loaded: true,
  exports: {
    logCaseHistory: async () => null,
    logCaseAction: async () => null,
  }
};

let failComment = false;
let failHistory = false;
require.cache[narrativeModulePath] = { id: narrativeModulePath, filename: narrativeModulePath, loaded: true, exports: {
  readJsonByRef: async ({ ref }) => {
    if (ref?.objectKey?.includes('/comments/')) { if (failComment) throw new Error('comment fail'); return { text: 'cloud comment text', note: 'cloud note' }; }
    if (failHistory) throw new Error('history fail'); return { description: 'cloud history description' };
  },
  uploadHistory: async () => ({ provider: 'google-drive', mode: 'firm_connected', fileId: 'h1', objectKey: 'dummy-history' }),
  uploadComment: async () => ({ provider: 'google-drive', mode: 'firm_connected', fileId: 'c1', objectKey: 'dummy-comment' })
} };
require.cache[docketNarrativeModulePath] = { id: docketNarrativeModulePath, filename: docketNarrativeModulePath, loaded: true, exports: { readNarrative: async () => null } };

const buildSvc = require('../src/services/caseQuery.service');

function mkModel(rows) { return { find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ select: () => ({ lean: () => ({ exec: async () => [...rows] }) }) }) }) }) }), countDocuments: () => ({ exec: async () => rows.length }) }; }

function makeService() {
  const commentsRows = [{ _id: 'c1', caseId: 'D1', text: 'mongo text', note: 'mongo note', commentRef: { provider: 'google-drive', mode: 'firm_connected', fileId: 'f1', objectKey: 'firms/f1/dockets/D1/comments/C1.json' } }];
  const historyRows = [{ _id: 'h1', actionType: 'UPDATE', description: 'mongo desc', timestamp: new Date(), historyRef: { provider: 'google-drive', mode: 'firm_connected', fileId: 'h1', objectKey: 'firms/f1/dockets/D1/history/H1.json' } }];
  return buildSvc({
    randomUUID: () => 'rid',
    loadCaseRecordCoalesced: async () => ({ _id: 'mongo1', caseId: 'D1', firmId: 'f1', createdByXID: 'X1', assignedToXID: 'X1', caseInternalId: 'i1', caseNumber: 'n1', lifecycle: 'OPEN' }),
    checkCaseAccess: () => true,
    enforceTenantScope: (q) => q,
    sanitizeOutput: (v) => v,
    normalizeLifecycle: (v) => v,
    enforceDocketLifecycleDefault: () => {},
    serializeDocketDetailDto: (d) => d,
    isProduction: () => true,
    incrementTenantMetric: async () => {},
    Comment: mkModel(commentsRows),
    CaseHistory: { ...mkModel(historyRows), create: async () => ({}) },
    CaseAudit: { ...mkModel([]), create: async () => ({}) },
    Attachment: { find: () => ({ select: () => ({ sort: () => ({ maxTimeMS: () => ({ lean: async () => [] }) }) }) }) },
    User: { find: () => ({ select: () => ({ maxTimeMS: () => ({ lean: async () => [] }) }) }), findOne: () => ({ select: () => ({ maxTimeMS: () => ({ lean: async () => null }) }) }) },
    Team: { findOne: () => ({ select: () => ({ maxTimeMS: () => ({ lean: async () => null }) }) }) },
    Invoice: { find: () => ({ sort: () => ({ maxTimeMS: () => ({ lean: async () => [] }) }) }) },
    ClientRepository: { findByClientId: async () => null },
    slaService: { getSlaStatus: () => 'ON_TRACK' },
  });
}

async function run(commentFails, historyFails) {
  failComment = commentFails; failHistory = historyFails;
  const svc = makeService();
  const req = { params: { caseId: 'D1' }, query: {}, user: { firmId: 'f1', xID: 'X1', role: 'USER', email: 'u@x.com' }, set(){}, removeHeader(){} };
  const res = { statusCode: 200, set(){}, removeHeader(){}, status(c){ this.statusCode=c; return this; }, json(b){ this.body=b; return this; } };
  await svc.getCaseByCaseId(req, res);
  assert.strictEqual(res.statusCode, 200);
  return res.body.data;
}

(async () => {
  const hydrated = await run(false, false);
  assert.strictEqual(hydrated.comments[0].text, 'cloud comment text');
  assert.strictEqual(hydrated.history[0].description, 'cloud history description');
  const commentFail = await run(true, false);
  assert.strictEqual(commentFail.comments[0].commentWarning, 'comment_content_unavailable');
  const historyFail = await run(false, true);
  assert.strictEqual(historyFail.history[0].historyWarning, 'history_content_unavailable');
  console.log('caseQuery.commentHistoryHydration.test.js passed');
})();
