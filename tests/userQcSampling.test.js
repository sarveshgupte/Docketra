#!/usr/bin/env node
const assert = require('assert');
const { resolveQcRoutingDecision } = require('../src/services/docketWorkflow.service');

(function run() {
  const mockDocket = {
    caseId: 'DOCKET123',
    _id: 'docket_obj_id_123',
  };

  const mockCategory = {
    qcPercent: 25,
  };

  const mockSubcategory = {
    qcPercent: 50,
  };

  // Case 1: No resolver user (falls back to category/subcategory)
  const decision1 = resolveQcRoutingDecision({
    docket: mockDocket,
    category: mockCategory,
    subcategory: mockSubcategory,
    sendToQC: false,
    resolverUser: null,
  });
  assert.strictEqual(decision1.percent, 50, 'Should fall back to subcategory rate of 50%');

  // Case 2: Resolver user with no custom rate set (null)
  const decision2 = resolveQcRoutingDecision({
    docket: mockDocket,
    category: mockCategory,
    subcategory: mockSubcategory,
    sendToQC: false,
    resolverUser: { qcSamplingRate: null },
  });
  assert.strictEqual(decision2.percent, 50, 'Should fall back to subcategory rate of 50% when user rate is null');

  // Case 3: Trainee user with 100% custom rate override
  const decision3 = resolveQcRoutingDecision({
    docket: mockDocket,
    category: mockCategory,
    subcategory: mockSubcategory,
    sendToQC: false,
    resolverUser: { qcSamplingRate: 100 },
  });
  assert.strictEqual(decision3.percent, 100, 'User rate should override default to 100%');
  assert.strictEqual(decision3.routeToQc, true, 'Should route to QC with 100% rate');
  assert.strictEqual(decision3.source, 'user_sampled', 'Source should indicate user_sampled');

  // Case 4: Senior user with 10% custom rate override
  const decision4 = resolveQcRoutingDecision({
    docket: mockDocket,
    category: mockCategory,
    subcategory: mockSubcategory,
    sendToQC: false,
    resolverUser: { qcSamplingRate: 10 },
  });
  assert.strictEqual(decision4.percent, 10, 'User rate should override default to 10%');
  assert.strictEqual(decision4.source, decision4.routeToQc ? 'user_sampled' : 'none', 'Source should match routing decision');

  // Case 5: User with 0% custom rate override
  const decision5 = resolveQcRoutingDecision({
    docket: mockDocket,
    category: mockCategory,
    subcategory: mockSubcategory,
    sendToQC: false,
    resolverUser: { qcSamplingRate: 0 },
  });
  assert.strictEqual(decision5.percent, 0, 'User rate should override default to 0%');
  assert.strictEqual(decision5.routeToQc, false, 'Should never route to QC when rate is 0%');

  console.log('✓ user-level qc sampling override logic verified successfully');
})();
