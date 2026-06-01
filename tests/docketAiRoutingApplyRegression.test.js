#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = process.cwd();
const mod = (p) => path.resolve(root, p);
const mockModule = (relativePath, exportsValue) => {
  const full = mod(relativePath);
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exportsValue,
  };
};

let saved = false;
let resolvedIdentifier = null;
const docketDoc = {
  caseId: 'DOCKET-20260526-00001',
  caseNumber: 'DOCKET-20260526-00001',
  caseInternalId: 'internal-1',
  firmId: 'firm-1',
  ownerTeamId: '60d5ec49f3e1a329dc3309a1',
  workbasketId: '60d5ec49f3e1a329dc3309a1',
  routedToTeamId: null,
  aiRouting: {
    suggestedTeam: 'Tax Team',
    suggestedWorkbasketId: '60d5ec49f3e1a329dc3309a2',
    status: 'PENDING',
  },
  save: async () => { saved = true; },
};

const TeamMock = {
  findOne: () => ({
    select: () => ({
      lean: async () => ({
        _id: '60d5ec49f3e1a329dc3309a2',
        name: 'Tax Team',
      }),
    }),
  }),
};

const CaseMock = {
  findOne: () => docketDoc,
};

mockModule('src/models/Attachment.model.js', { findOne: () => ({ sort: () => null }) });
mockModule('src/models/Client.model.js', { find: () => ({ select: () => ({ lean: async () => [] }) }) });
mockModule('src/models/Category.model.js', { find: () => ({ select: () => ({ lean: async () => [] }) }) });
mockModule('src/models/Case.model.js', CaseMock);
mockModule('src/models/Team.model.js', TeamMock);
mockModule('src/services/ai/ai.service.js', {});
mockModule('src/utils/caseIdentifier.js', {
  resolveCaseIdentifier: async (_firmId, identifier) => {
    resolvedIdentifier = identifier;
    return 'internal-1';
  },
});
mockModule('src/utils/log.js', { info: () => {}, warn: () => {}, error: () => {} });
mockModule('src/utils/clientStatus.js', { buildClientStatusQuery: () => ({}) });

const controllerPath = mod('src/controllers/docketAi.controller.js');
delete require.cache[controllerPath];
const { applyAiRouting } = require('../src/controllers/docketAi.controller');

const req = {
  params: { caseId: 'DOCKET-20260526-00001' },
  user: { firmId: 'firm-1', role: 'ADMIN', xID: 'X000001' },
};

const res = {};
res.status = (code) => { res.statusCode = code; return res; };
res.json = (body) => { res.body = body; return res; };

(async () => {
  await applyAiRouting(req, res);

  assert.strictEqual(res.statusCode, undefined);
  assert.strictEqual(res.body.success, true, 'applyAiRouting should succeed with :caseId route param');
  assert.strictEqual(resolvedIdentifier, 'DOCKET-20260526-00001', 'controller should resolve using caseId when docketId is absent');

  assert.strictEqual(docketDoc.ownerTeamId, '60d5ec49f3e1a329dc3309a2', 'ownerTeamId should be updated to suggested workbasket');
  assert.strictEqual(docketDoc.workbasketId, '60d5ec49f3e1a329dc3309a2', 'workbasketId should be updated to suggested workbasket');
  assert.strictEqual(docketDoc.routedToTeamId, '60d5ec49f3e1a329dc3309a2', 'routedToTeamId should be updated to suggested workbasket');
  assert.strictEqual(docketDoc.aiRouting.status, 'APPLIED', 'aiRouting status should be APPLIED');
  assert.strictEqual(saved, true, 'docket should be saved');

  console.log('docketAiRoutingApplyRegression.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
