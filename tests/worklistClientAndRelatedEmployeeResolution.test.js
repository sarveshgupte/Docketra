#!/usr/bin/env node
/**
 * Verifies worklists correctly resolve clientName (including snapshot and multi-tenant fallback)
 * and project relatedEmployeeUser / relatedEmployeeName / relatedEmployeeXID.
 */

const assert = require('assert');

const mockQuery = (data) => {
  const q = {
    select: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: async () => data,
  };
  return q;
};

const createRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const mockCases = [
  {
    _id: '507f1f77bcf86cd799439011',
    caseId: 'DOCKET-001',
    caseNumber: 'DOCKET-001',
    caseName: 'Docket with direct clientName',
    clientId: 'C000001',
    clientName: 'Direct Client Inc',
    category: 'ROC',
    subcategory: 'Annual Filing',
    status: 'UNASSIGNED',
    createdAt: new Date(),
  },
  {
    _id: '507f1f77bcf86cd799439012',
    caseId: 'DOCKET-002',
    caseNumber: 'DOCKET-002',
    caseName: 'Docket with clientSnapshot',
    clientId: 'C000002',
    clientSnapshot: { businessName: 'Snapshot Corp' },
    category: 'Tax',
    subcategory: 'GST Audit',
    status: 'UNASSIGNED',
    createdAt: new Date(),
  },
  {
    _id: '507f1f77bcf86cd799439013',
    caseId: 'DOCKET-003',
    caseNumber: 'DOCKET-003',
    caseName: 'Docket with related employee and missing client lookup',
    clientId: 'C000003',
    category: 'Payroll',
    subcategory: 'Payroll HR',
    status: 'UNASSIGNED',
    createdAt: new Date(),
    relatedEmployeeUser: {
      xID: 'EMP001',
      name: 'John Doe',
      email: 'john@example.com',
    },
  },
];

let queriedFirmIds = null;

const CaseMock = {
  find: () => mockQuery(mockCases),
  findOne: () => mockQuery(null),
  countDocuments: async () => mockCases.length,
  updateMany: async () => ({ acknowledged: true }),
};

const ClientMock = {
  find: (filter) => {
    queriedFirmIds = filter.firmId?.$in;
    return mockQuery([
      { clientId: 'C000003', businessName: 'Looked-Up Industries' },
    ]);
  },
  findOne: () => mockQuery(null),
  findById: () => mockQuery(null),
};

const FirmMock = {
  find: () => mockQuery([]),
  findOne: () => mockQuery(null),
  findById: () => mockQuery(null),
};

const TeamMock = {
  find: () => mockQuery([]),
};

require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Client.model')] = { exports: ClientMock };
require.cache[require.resolve('../src/models/Firm.model')] = { exports: FirmMock };
require.cache[require.resolve('../src/models/Team.model')] = { exports: TeamMock };
require.cache[require.resolve('../src/models/User.model')] = {
  exports: {
    findOne: () => mockQuery({ xID: 'X000001', firmId: 'firm-123', role: 'Admin' }),
    find: () => mockQuery([]),
  },
};
require.cache[require.resolve('../src/models/Comment.model')] = { exports: { find: () => mockQuery([]) } };
require.cache[require.resolve('../src/models/Attachment.model')] = { exports: { find: () => mockQuery([]) } };
require.cache[require.resolve('../src/services/auditLog.service')] = {
  exports: {
    logCaseListViewed: async () => {},
  },
};
require.cache[require.resolve('../src/services/caseAction.service')] = {
  exports: {
    autoReopenExpiredPendingCases: async () => {},
  },
};
require.cache[require.resolve('../src/services/docketWorkflow.service')] = {
  exports: {
    reopenDuePending: async () => {},
  },
};
require.cache[require.resolve('../src/services/tenantIdentity.service')] = {
  exports: {
    resolveClientOwnershipFirmId: async (firmId) => `owner-${firmId}`,
    resolveCanonicalTenantForUser: async (user) => ({ ownershipFirmId: user?.firmId || 'firm-123' }),
  },
};

const searchController = require('../src/controllers/search.controller');

async function testGlobalWorklist() {
  const req = {
    firmId: 'firm-123',
    user: {
      xID: 'X000001',
      firmId: 'firm-123',
      role: 'Admin',
    },
    query: {
      sortBy: 'createdAt',
    },
  };
  const res = createRes();

  await searchController.globalWorklist(req, res);

  assert.strictEqual(res.body.success, true, 'globalWorklist should succeed');
  const items = res.body.data;
  assert.strictEqual(items.length, 3, 'should return 3 cases');

  // Case 1: direct clientName
  assert.strictEqual(items[0].clientName, 'Direct Client Inc', 'Case 1 should resolve direct clientName');

  // Case 2: clientSnapshot.businessName
  assert.strictEqual(items[1].clientName, 'Snapshot Corp', 'Case 2 should resolve clientSnapshot businessName');

  // Case 3: looked-up clientName and relatedEmployeeUser
  assert.strictEqual(items[2].clientName, 'Looked-Up Industries', 'Case 3 should resolve clientName from Client.find lookup');
  assert.strictEqual(items[2].relatedEmployeeName, 'John Doe', 'Case 3 should resolve relatedEmployeeName');
  assert.strictEqual(items[2].relatedEmployeeXID, 'EMP001', 'Case 3 should resolve relatedEmployeeXID');
  assert.ok(queriedFirmIds.includes('firm-123'), 'lookup should include user firmId');
  assert.ok(queriedFirmIds.includes('owner-firm-123'), 'lookup should include ownershipFirmId candidate fallback');

  console.log('✓ globalWorklist client and related employee resolution passed');
}

async function testEmployeeWorklist() {
  const req = {
    firmId: 'firm-123',
    user: {
      xID: 'X000001',
      firmId: 'firm-123',
      role: 'Admin',
    },
    query: {
      userXID: 'X000001',
    },
  };
  const res = createRes();

  await searchController.employeeWorklist(req, res);

  assert.strictEqual(res.body.success, true, 'employeeWorklist should succeed');
  const items = res.body.data;
  assert.strictEqual(items.length, 3, 'should return 3 cases');

  assert.strictEqual(items[0].clientName, 'Direct Client Inc');
  assert.strictEqual(items[1].clientName, 'Snapshot Corp');
  assert.strictEqual(items[2].clientName, 'Looked-Up Industries');
  assert.strictEqual(items[2].relatedEmployeeName, 'John Doe');
  assert.strictEqual(items[2].relatedEmployeeXID, 'EMP001');

  console.log('✓ employeeWorklist client and related employee resolution passed');
}

(async () => {
  try {
    await testGlobalWorklist();
    await testEmployeeWorklist();
    console.log('All worklist client and related employee resolution tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
