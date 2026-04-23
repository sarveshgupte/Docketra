#!/usr/bin/env node
const assert = require('assert');

// 1. Setup Mock Implementations
const mockCaseModel = {
  aggregate: async () => [],
  countDocuments: async () => 0,
  find: () => {
    const chain = {
      sort: () => chain,
      limit: () => chain,
      select: () => chain,
      distinct: async () => [],
      lean: async () => [{
        _id: 'pending1',
        title: 'Case 1',
        status: 'PENDING',
        clientId: 'client1',
        pendingUntil: new Date('2023-01-01'),
        createdAt: new Date('2023-01-01')
      }]
    };
    return chain;
  }
};

const mockClientModel = {
  find: () => ({
    select: () => ({
      lean: async () => []
    }),
    lean: async () => []
  }),
  findOne: () => ({
    lean: async () => null
  })
};

const mockUserModel = {
  find: () => ({
    select: () => ({
      lean: async () => []
    })
  })
};

const mockTaskModel = {
  find: () => ({
    populate: () => ({
      lean: async () => []
    })
  })
};

const mockCaseAuditModel = {
  find: () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => []
      })
    })
  }),
  aggregate: async () => []
};

const mockAuthAuditModel = {
  find: () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => []
      })
    })
  })
};

const mockTenantCaseMetricsDaily = {};
const mockTenantMetricsService = {
  getLatestTenantMetrics: async () => ({
    openCases: 10,
    overdueCases: 2,
    pendedCases: 1,
    filedCases: 0,
    resolvedCases: 5,
    totalCases: 16
  }),
  getTenantMetricsByRange: async () => []
};

// 2. Inject Mocks into the Require Cache
const models = {
  '../models/Case.model': mockCaseModel,
  '../models/Client.model': mockClientModel,
  '../models/User.model': mockUserModel,
  '../models/Task': mockTaskModel,
  '../models/CaseAudit.model': mockCaseAuditModel,
  '../models/AuthAudit.model': mockAuthAuditModel,
};

Object.entries(models).forEach(([path, mock]) => {
  const resolvedPath = require.resolve(`../src/models/${path.replace('../models/', '')}`);
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: mock
  };
});

const metricsServicePath = require.resolve('../src/services/tenantCaseMetrics.service');
require.cache[metricsServicePath] = {
  id: metricsServicePath,
  filename: metricsServicePath,
  loaded: true,
  exports: mockTenantMetricsService
};

// Mock dependencies
const mockJson2Csv = {
  Parser: class {
    parse() { return 'mock,csv,data'; }
  }
};
const json2CsvPath = require.resolve('json2csv');
require.cache[json2CsvPath] = {
  id: json2CsvPath,
  filename: json2CsvPath,
  loaded: true,
  exports: mockJson2Csv
};

const mockExcelService = {
  generateCasesExcelWorkbook: () => ({
    xlsx: {
      write: async (res) => { res.excelWritten = true; }
    }
  })
};
const excelServicePath = require.resolve('../src/services/excel.service');
require.cache[excelServicePath] = {
  id: excelServicePath,
  filename: excelServicePath,
  loaded: true,
  exports: mockExcelService
};

class MockPDFDocument {
  constructor() {
    this.written = [];
  }
  pipe(res) { res.pdfPiped = true; }
  fontSize() { return this; }
  text(str) { this.written.push(str); return this; }
  moveDown() { return this; }
  end() { this.ended = true; }
}

const mockPdfKit = MockPDFDocument;
const pdfKitPath = require.resolve('pdfkit');
require.cache[pdfKitPath] = {
  id: pdfKitPath,
  filename: pdfKitPath,
  loaded: true,
  exports: mockPdfKit
};

// 3. Load Controller After Mocks
const reportsController = require('../src/controllers/reports.controller');

// Utility to create mock request and response
function createMockHttp() {
  const req = {
    user: { firmId: 'firm123', role: 'ADMIN' },
    query: {},
    params: {}
  };
  const res = {
    statusCode: 200,
    jsonData: null,
    headers: {},
    sentData: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    send(data) {
      this.sentData = data;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
  return { req, res };
}


async function runTests() {
  console.log('Running tests for reports.controller.js...');

  // Test 1: getCaseMetrics - Missing fromDate/toDate
  {
    const { req, res } = createMockHttp();
    req.query.fromDate = '2023-01-01'; // Missing toDate
    await reportsController.getCaseMetrics(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('Both fromDate and toDate are required'));
    console.log('✅ getCaseMetrics: validation failure handled');
  }

  // Test 2: getCaseMetrics - Success
  {
    const { req, res } = createMockHttp();
    await reportsController.getCaseMetrics(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.byStatus.OPEN, 10);
    console.log('✅ getCaseMetrics: success scenario handled');
  }

  // Test 2b: getCaseMetrics - missing firm context fails closed
  {
    const { req, res } = createMockHttp();
    req.user = { role: 'ADMIN' };
    await reportsController.getCaseMetrics(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('firm context required'));
    console.log('✅ getCaseMetrics: missing tenant context blocked');
  }

  // Test 2c: getCaseMetrics - superadmin blocked from firm-scoped reporting endpoint
  {
    const { req, res } = createMockHttp();
    req.user = { role: 'SuperAdmin', firmId: 'firm123' };
    await reportsController.getCaseMetrics(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('SuperAdmin cannot access firm-scoped reports'));
    console.log('✅ getCaseMetrics: superadmin blocked from firm-scoped route');
  }

  // Test 3: getPendingCasesReport - Success
  {
    const { req, res } = createMockHttp();
    req.query.category = 'Immigration';
    // mock behavior for Case.aggregate
    mockCaseModel.aggregate = async () => [{
      _id: 'pending1',
      title: 'Case 1',
      status: 'PENDING',
      clientId: 'client1'
    }];
    mockClientModel.find = () => ({
      select: () => ({
        lean: async () => [{ clientId: 'client1', businessName: 'ACME Corp' }]
      }),
      lean: async () => [{ clientId: 'client1', businessName: 'ACME Corp' }]
    });

    await reportsController.getPendingCasesReport(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.cases[0].title, 'Case 1');
    assert.strictEqual(res.jsonData.data.cases[0].clientName, 'ACME Corp');
    console.log('✅ getPendingCasesReport: success scenario handled');
  }

  // Test 4: getCasesByDateRange - Invalid pagination
  {
    const { req, res } = createMockHttp();
    req.query.page = 'invalid';
    await reportsController.getCasesByDateRange(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('page must be >= 1'));
    console.log('✅ getCasesByDateRange: invalid pagination handled');
  }

  // Test 5: exportCasesCSV - Success
  {
    const { req, res } = createMockHttp();
    req.query.fromDate = '2023-01-01';
    req.query.toDate = '2023-12-31';
    await reportsController.exportCasesCSV(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/csv');
    assert.ok(res.headers['Content-Disposition'].includes('attachment; filename="docketra-report-'));
    assert.strictEqual(res.sentData, 'mock,csv,data');
    console.log('✅ exportCasesCSV: success scenario handled');
  }


  // Test 5b: exportCasesCSV - Failure reason code
  {
    const { req, res } = createMockHttp();
    req.query.fromDate = '2023-01-01';
    req.query.toDate = '2023-12-31';
    const oldFind = mockCaseModel.find;
    mockCaseModel.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => { throw new Error('csv-export-boom'); }
        })
      })
    });
    await reportsController.exportCasesCSV(req, res);
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.reasonCode, 'report_export_failed');
    mockCaseModel.find = oldFind;
    console.log('✅ exportCasesCSV: failure reason code emitted');
  }
  // Test 6: exportCasesExcel - Total exceeds limit
  {
    const { req, res } = createMockHttp();
    req.query.fromDate = '2023-01-01';
    req.query.toDate = '2023-12-31';
    const oldFind = mockCaseModel.find;
    mockCaseModel.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => Array.from({ length: 5001 }) // > MAX_EXPORT_ROWS
        })
      })
    });
    await reportsController.exportCasesExcel(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('Export exceeds maximum row limit'));
    console.log('✅ exportCasesExcel: max export rows limit handled');
    mockCaseModel.find = oldFind;
  }

  // Test 7: exportCasesExcel - Success
  {
    const { req, res } = createMockHttp();
    req.query.fromDate = '2023-01-01';
    req.query.toDate = '2023-12-31';
    mockCaseModel.countDocuments = async () => 10;
    await reportsController.exportCasesExcel(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.ok(res.headers['Content-Disposition'].includes('attachment; filename="docketra-report-'));
    assert.strictEqual(res.excelWritten, true);
    assert.strictEqual(res.ended, true);
    console.log('✅ exportCasesExcel: success scenario handled');
  }

  // Test 8: getAuditLogs - Invalid limit
  {
    const { req, res } = createMockHttp();
    req.query.limit = '1000'; // > MAX_AUDIT_LOG_LIMIT
    await reportsController.getAuditLogs(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('limit cannot exceed'));
    console.log('✅ getAuditLogs: max limit handled');
  }

  // Test 9: generateClientFactSheetPdf - Client not found
  {
    const { req, res } = createMockHttp();
    req.params.clientId = 'nonexistent';
    mockClientModel.findOne = () => ({
      lean: async () => null
    });
    await reportsController.generateClientFactSheetPdf(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.jsonData.success, false);
    assert.ok(res.jsonData.message.includes('Client not found'));
    console.log('✅ generateClientFactSheetPdf: client not found handled');
  }

  // Test 10: generateClientFactSheetPdf - Success
  {
    const { req, res } = createMockHttp();
    req.params.clientId = 'client123';
    mockClientModel.findOne = () => ({
      lean: async () => ({ clientId: 'client123', businessName: 'Test Biz' })
    });
    await reportsController.generateClientFactSheetPdf(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Content-Type'], 'application/pdf');
    assert.ok(res.headers['Content-Disposition'].includes('attachment; filename="client-fact-sheet-client123.pdf"'));
    assert.strictEqual(res.pdfPiped, true);
    console.log('✅ generateClientFactSheetPdf: success scenario handled');
  }

  console.log('🎉 All reports.controller tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
