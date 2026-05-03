#!/usr/bin/env node
const assert = require('assert');

const leadModelPath = require.resolve('../src/models/Lead.model');
const formModelPath = require.resolve('../src/models/Form.model');
const caseModelPath = require.resolve('../src/models/Case.model');
const userModelPath = require.resolve('../src/models/User.model');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

(async () => {
  swap(leadModelPath, {
    find: () => ({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }),
  });
  swap(userModelPath, { find: () => ({ select: () => ({ lean: async () => [] }) }) });
  swap(caseModelPath, { aggregate: async () => [] });
  swap(formModelPath, {
    find: () => ({ sort: () => ({ lean: async () => [] }) }),
  });

  const { listLeads } = require('../src/controllers/lead.controller');
  const { listForms } = require('../src/controllers/form.controller');

  const req = { user: { firmId: '507f1f77bcf86cd799439011' }, query: { limit: '100' } };

  const leadsRes = createRes();
  await listLeads(req, leadsRes);
  assert.strictEqual(leadsRes.statusCode, 200);
  assert.strictEqual(leadsRes.body.success, true);
  assert.deepStrictEqual(leadsRes.body.data, []);

  const formsRes = createRes();
  await listForms(req, formsRes);
  assert.strictEqual(formsRes.statusCode, 200);
  assert.strictEqual(formsRes.body.success, true);
  assert.deepStrictEqual(formsRes.body.data, []);

  console.log('knowledgeIntake.emptyState.controller.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[require.resolve('../src/controllers/lead.controller')];
  delete require.cache[require.resolve('../src/controllers/form.controller')];
});
