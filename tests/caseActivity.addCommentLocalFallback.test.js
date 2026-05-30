const assert = require('assert');

const serviceModulePath = require.resolve('../src/services/caseActivity.service');
const narrativeModulePath = require.resolve('../src/services/commentHistoryNarrativeStorage.service');
const auditLogModulePath = require.resolve('../src/services/auditLog.service');
const CommentModel = require('../src/models/Comment.model');
const CaseHistoryModel = require('../src/models/CaseHistory.model');

delete require.cache[serviceModulePath];
delete require.cache[narrativeModulePath];
delete require.cache[auditLogModulePath];

const historyCalls = [];

require.cache[narrativeModulePath] = {
  id: narrativeModulePath,
  filename: narrativeModulePath,
  loaded: true,
  exports: {
    uploadComment: async () => {
      throw new Error('storage unavailable');
    },
  },
};

require.cache[auditLogModulePath] = {
  id: auditLogModulePath,
  filename: auditLogModulePath,
  loaded: true,
  exports: {
    logCaseHistory: async (payload) => {
      historyCalls.push(payload);
      return { _id: 'history-1', ...payload };
    },
  },
};

const buildCaseActivityService = require('../src/services/caseActivity.service');

const comments = [];
const auditCalls = [];
const notifications = [];
const activities = [];
const resolvedFirmIds = [];

const service = buildCaseActivityService({
  randomUUID: () => 'comment-uuid',
  COMMENT_PREVIEW_LENGTH: 40,
  CaseRepository: {
    findByInternalId: async () => ({
      caseId: 'DOCKET-20260421-00001',
      caseInternalId: '507f1f77bcf86cd799439011',
      firmId: 'firm-1',
      assignedToXID: 'X000002',
      createdByXID: 'X000003',
      lockStatus: { isLocked: false },
    }),
  },
  resolveCaseIdentifier: async (firmId) => {
    resolvedFirmIds.push(firmId);
    return '507f1f77bcf86cd799439011';
  },
  Comment: {
    create: async (payload) => {
      comments.push(payload);
      return { _id: 'comment-1', createdAt: new Date('2026-05-30T05:30:00.000Z'), ...payload };
    },
    distinct: async () => ['X000004'],
    find: () => ({
      select: () => ({
        sort: () => ({
          lean: async () => comments.map((comment, index) => ({ _id: `comment-${index + 1}`, createdAt: new Date(), ...comment })),
        }),
      }),
    }),
  },
  CaseAudit: {
    create: async (payload) => {
      auditCalls.push(payload);
      return { _id: 'audit-1', ...payload };
    },
  },
  enforceTenantScope: (query) => query,
  sanitizeForLog: (value, maxLength) => String(value || '').slice(0, maxLength),
  logActivitySafe: async (payload) => {
    activities.push(payload);
  },
  createNotification: async (payload) => {
    notifications.push(payload);
  },
  NotificationTypes: { COMMENT_ADDED: 'COMMENT_ADDED' },
  buildAddCommentErrorResponse: (error) => ({
    status: 500,
    body: { success: false, message: error.message },
  }),
});

const req = {
  params: { caseId: 'CASE-20260421-00001' },
  body: { text: 'comment test' },
  firmId: 'default-client-runtime-tenant',
  user: {
    email: 'sarvesh@example.com',
    xID: 'X000001',
    name: 'Sarvesh Gupte',
    role: 'USER',
    firmId: 'firm-1',
  },
  headers: {},
};

const res = {
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
};

(async () => {
  assert.ifError(new CommentModel({
    caseId: 'DOCKET-20260421-00001',
    firmId: 'firm-1',
    text: 'comment test',
    createdBy: 'sarvesh@example.com',
    storageMode: 'local_fallback',
  }).validateSync());
  assert.ifError(new CaseHistoryModel({
    caseId: 'DOCKET-20260421-00001',
    firmId: 'firm-1',
    actionType: 'CASE_COMMENT_ADDED',
    description: 'Comment added',
    performedBy: 'sarvesh@example.com',
    storageMode: 'local_fallback',
  }).validateSync());

  await service.addComment(req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(comments.length, 1);
  assert.deepStrictEqual(resolvedFirmIds, ['firm-1']);
  assert.strictEqual(comments[0].storageMode, 'local_fallback');
  assert.strictEqual(comments[0].caseId, 'DOCKET-20260421-00001');
  assert.strictEqual(auditCalls.length, 1);
  assert.strictEqual(auditCalls[0].actionType, 'CASE_COMMENT_ADDED');
  assert.strictEqual(auditCalls[0].caseId, 'DOCKET-20260421-00001');
  assert.strictEqual(historyCalls.length, 1);
  assert.strictEqual(historyCalls[0].actionType, 'CASE_COMMENT_ADDED');
  assert.strictEqual(historyCalls[0].caseId, 'DOCKET-20260421-00001');
  assert.strictEqual(activities.length, 1);
  assert.ok(notifications.length >= 1);

  console.log('caseActivity.addCommentLocalFallback.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
