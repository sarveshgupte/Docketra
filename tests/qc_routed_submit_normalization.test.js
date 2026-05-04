#!/usr/bin/env node
const assert = require('assert');

const mongoose = require('mongoose');
require.cache[require.resolve('../src/services/docketAudit.service')] = { exports: { logDocketEvent: async () => {}, createLog: async () => {} } };
require.cache[require.resolve('../src/services/docketActivity.service')] = { exports: { logActivitySafe: () => {} } };
require.cache[require.resolve('../src/services/docketEvents.service')] = { exports: { EVENT_NAMES: { QC_REQUEST: 'QC_REQUEST' }, emitDocketEvent: () => {} } };
require.cache[require.resolve('../src/domain/notifications')] = { exports: { NotificationTypes: {}, createNotification: async () => {} } };

const CaseMock = { findOne: () => null };
const TeamMock = { findOne: () => ({ session: () => ({ select: () => ({ lean: async () => ({ _id: 'QCWB1' }) }) }) }) };
const CategoryMock = { findOne: () => ({ session: () => ({ lean: async () => ({ forceQC: false }) }) }) };
require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Team.model')] = { exports: TeamMock };
require.cache[require.resolve('../src/models/Category.model')] = { exports: CategoryMock };

const svc = require('../src/services/docketWorkflow.service');

(async () => {
  const fake = {
    caseId: 'C100', firmId: 'F1', status: 'OPEN', state: 'IN_PROGRESS', lifecycle: 'ACTIVE',
    assignedToXID: 'X10', routedToTeamId: 'PRIMARY1', ownerTeamId: 'PRIMARY1', workbasketId: 'PRIMARY1',
    qc: {}, toObject: function () { return { status: this.status }; }, save: async () => {},
  };
  CaseMock.findOne = () => ({ session: async () => fake });

  const originalStart = mongoose.startSession;
  mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
  const out = await svc.transition({ docketId: 'C100', firmId: 'F1', actor: { xID: 'X10', role: 'USER' }, toState: 'RESOLVED', comment: 'send qc', sendToQC: true });
  mongoose.startSession = originalStart;

  assert.strictEqual(out.ownerTeamId, 'QCWB1');
  assert.strictEqual(out.workbasketId, 'QCWB1');
  assert.strictEqual(out.routedToTeamId, null);
  assert.strictEqual(out.assignedToXID, null);
  assert.strictEqual(out.state, 'IN_QC');
  assert.strictEqual(out.queueType, 'GLOBAL');
  console.log('✓ routed docket QC submit normalization');
})();
