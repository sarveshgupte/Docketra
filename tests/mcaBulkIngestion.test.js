'use strict';

const assert = require('assert');
const { mcaBulkIngestionService } = require('../src/services/mcaBulkIngestion.service');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/mcaCompliance.routes.schema');

function createMockResponse() {
  return {
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
}

// 1. Test CSV line parsing
(function testParseCsvLine() {
  const line = 'U72900KA2022PTC123456,"ACME TECH, PRIVATE LIMITED",ACTIVE,"Plot 12, Ind Area, Bangalore",5000000';
  const cols = mcaBulkIngestionService.parseCsvLine(line);
  assert.strictEqual(cols.length, 5);
  assert.strictEqual(cols[0], 'U72900KA2022PTC123456');
  assert.strictEqual(cols[1], 'ACME TECH, PRIVATE LIMITED');
  assert.strictEqual(cols[2], 'ACTIVE');
  assert.strictEqual(cols[3], 'Plot 12, Ind Area, Bangalore');
  assert.strictEqual(cols[4], '5000000');
  console.log('✓ testParseCsvLine passed');
})();

// 2. Test row normalization across header variations
(function testNormalizeRow() {
  const rawGovRow = {
    'CORPORATE_IDENTIFICATION_NUMBER': 'U72900MH2020PTC123456',
    'Company_Name': 'APEX INNOVATIONS PRIVATE LIMITED',
    'Company_Status': 'Active',
    'Company_Class': 'Private',
    'ROC_Code': 'RoC-Mumbai',
    'Date_of_Registration': '15-08-2020',
    'Authorized_Capital': '10,00,000',
    'Paidup_Capital': '1,00,000',
    'Registered_Office_Address': '101 Technopolis, Andheri East, Mumbai 400069',
    'Email_ID': 'INFO@APEXINNOVATIONS.IN',
    'Registered_State': 'Maharashtra',
  };

  const normalized = mcaBulkIngestionService.normalizeRow(rawGovRow);
  assert.ok(normalized, 'Row should normalize successfully');
  assert.strictEqual(normalized.cin, 'U72900MH2020PTC123456');
  assert.strictEqual(normalized.companyName, 'APEX INNOVATIONS PRIVATE LIMITED');
  assert.strictEqual(normalized.status, 'ACTIVE');
  assert.strictEqual(normalized.companyClass, 'PRIVATE');
  assert.strictEqual(normalized.roc, 'RoC-Mumbai');
  assert.strictEqual(normalized.authorizedCapital, 1000000);
  assert.strictEqual(normalized.paidUpCapital, 100000);
  assert.strictEqual(normalized.pinCode, '400069');
  assert.strictEqual(normalized.registeredEmail, 'info@apexinnovations.in');
  assert.strictEqual(normalized.incorporationDate.getUTCFullYear(), 2020);
  assert.strictEqual(normalized.incorporationDate.getUTCMonth(), 7); // August = 7
  assert.strictEqual(normalized.incorporationDate.getUTCDate(), 15);
  console.log('✓ testNormalizeRow passed');
})();

// 3. Test streaming ingestion from CSV content
(async function testIngestFromCsvContent() {
  const sampleCsv = `CIN,COMPANY_NAME,COMPANY_STATUS,COMPANY_CLASS,ROC,AUTHORIZED_CAPITAL,PAIDUP_CAPITAL,DATE_OF_REGISTRATION,REGISTERED_OFFICE_ADDRESS
U72900KA2021PTC111111,"ALPHA CLOUD TECHNOLOGIES PRIVATE LIMITED",Active,Private,RoC-Bangalore,500000,100000,01-01-2021,"Koramangala, Bangalore 560034"
L72900MH2010PLC222222,"BETA VENTURES LIMITED",Active,Public,RoC-Mumbai,50000000,45000000,15-06-2010,"BKC, Mumbai 400051"
`;

  const result = await mcaBulkIngestionService.ingestFromCsvContent(sampleCsv, { batchSize: 1 });
  assert.strictEqual(result.totalProcessed, 2, 'Should process 2 valid rows');
  assert.strictEqual(result.totalUpserted, 2, 'Should upsert 2 rows');
  assert.strictEqual(result.errorsCount, 0);
  console.log('✓ testIngestFromCsvContent passed');
})();

// 4. Test Route Schema Validation for Directory Search
(function testDirectorySearchValidation() {
  const middleware = validateRequest(routeSchemas['GET /directory/search']);
  const req = {
    body: {},
    params: {},
    query: {
      q: 'TATA',
      limit: 10,
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Valid directory search request should call next');
  assert.strictEqual(res.statusCode, 200);
  console.log('✓ testDirectorySearchValidation passed');
})();

// 5. Test Route Schema Validation Failure on Missing Query
(function testDirectorySearchMissingQuery() {
  const middleware = validateRequest(routeSchemas['GET /directory/search']);
  const req = {
    body: {},
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'Missing query should fail validation');
  assert.strictEqual(res.statusCode, 400);
  console.log('✓ testDirectorySearchMissingQuery passed');
})();

console.log('======================================');
console.log('ALL MCA Bulk Ingestion Tests PASSED!');
console.log('======================================');
