#!/usr/bin/env node
const assert = require('assert');

require.cache[require.resolve('../src/services/docketAudit.service')] = { exports: { logDocketEvent: async () => {}, createLog: async () => {} } };
require.cache[require.resolve('../src/services/docketActivity.service')] = { exports: { logActivitySafe: () => {} } };
require.cache[require.resolve('../src/services/docketEvents.service')] = { exports: { EVENT_NAMES: { PENDING_REOPEN: 'PENDING_REOPEN', QC_FAILURE: 'QC_FAILURE', QC_REQUEST: 'QC_REQUEST', ASSIGNMENT: 'ASSIGNMENT' }, emitDocketEvent: () => {} } };
require.cache[require.resolve('../src/domain/notifications')] = { exports: { NotificationTypes: {}, createNotification: async () => {} } };
const CaseMock = { find: async () => [], updateMany: async () => ({ modifiedCount: 0 }), updateOne: async () => ({ modifiedCount: 1 }), findOne: async () => null };
const TeamMock = { findOne: async () => null };
const CategoryMock = { findOne: async () => null };
require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Team.model')] = { exports: TeamMock };
require.cache[require.resolve('../src/models/Category.model')] = { exports: CategoryMock };
const svc = require('../src/services/docketWorkflow.service');

(async () => {
  // pending reopen keeps assignment and reopens to PERSONAL/IN_PROGRESS
  let updatePayload = null;
  CaseMock.find = async () => ([{ _id: '1', caseId: 'C1', firmId: 'F1', assignedToXID: 'X1' }]);
  CaseMock.updateMany = async (_f, u) => { updatePayload = u; return { modifiedCount: 1 }; };
  await svc.reopenDuePending();
  assert.strictEqual(updatePayload.$set.status, 'IN_PROGRESS');
  assert.strictEqual(updatePayload.$set.queueType, 'PERSONAL');
  assert.strictEqual(updatePayload.$set.assignedToXID, undefined);

  // qc transitions metadata/corrected flag
  const docket = {
    caseId: 'C2', firmId: 'F1', status: 'QC_PENDING', state: 'IN_QC', lifecycle: 'ACTIVE', qc: {}, toObject: () => ({ status: 'QC_PENDING' }), save: async () => {},
  };
  CaseMock.findOne = async () => docket;
  await svc.qcDecision({ docketId: 'C2', firmId: 'F1', actor: { xID: 'XQC', role: 'ADMIN' }, decision: 'CORRECTED', comment: 'ok' });
  assert.strictEqual(docket.qcFailedCorrected, true);

  // deactivation mapped active primary WB and excludes terminal
  const wb = { _id: 'WB1', firmId: 'F1', isActive: true, type: 'PRIMARY' };
  CaseMock.find = async () => ([{ _id: '2', category: 'Cat', subcategoryId: 'SUB1', status: 'ASSIGNED' }]);
  CategoryMock.findOne = async () => ({ firmId: 'F1', name: 'Cat', isActive: true, subcategories: [{ id: 'SUB1', isActive: true, workbasketId: 'WB1' }] });
  TeamMock.findOne = async () => wb;
  const out = await svc.handleUserDeactivation({ firmId: 'F1', userXID: 'x1' });
  assert.strictEqual(out.moved, 1);

  console.log('✓ pending/qc/deactivation normalization');
})();
