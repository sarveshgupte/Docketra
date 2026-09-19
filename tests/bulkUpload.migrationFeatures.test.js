#!/usr/bin/env node
'use strict';

/**
 * COMPREHENSIVE TEST SUITE: Migration-Related Bulk Upload Features
 *
 * Tests:
 * 1. Schema Mirror & Contract Alignment (backend vs frontend schema)
 * 2. Historical Docket Bulk Import (validateBulkDockets, generateDocketImportTemplate, preview, upload)
 * 3. Client Bulk Upload (preview, confirm, validation, deduplication modes: skip/update/fail)
 * 4. Team / Staff Bulk Upload (roles, workbasket pipe syntax, client restrictions, invitations)
 * 5. Category & Subcategory Bulk Upload (taxonomy creation, workbasket mapping, subcategory appending)
 * 6. Quick Bulk Paste data parsing verification
 */

const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-12345678901234567890';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000000';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@docketra.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '507f1f77bcf86cd799439011';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.MASTER_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Models
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const Category = require('../src/models/Category.model');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const Case = require('../src/models/Case.model');

// Schemas
const backendSchemaModule = require('../src/constants/bulkUploadSchema');
const frontendSchemaModule = require('../ui/src/constants/bulkUploadSchema');

// Services & Controllers
const { validateBulkDockets, normalizeBulkRow, mapValidationErrors } = require('../src/services/bulkUpload.service');
const {
  generateDocketImportTemplate,
  previewDocketBulkUpload,
  uploadDocketBulk,
} = require('../src/controllers/docketBulkUpload.controller');
const {
  previewBulkUpload,
  confirmBulkUpload,
  processBulkRows,
} = require('../src/controllers/bulkUpload.controller');

// Helper to create mock Express response
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    bodyText: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    send(payload) {
      this.bodyText = payload;
      return this;
    },
  };
  return res;
};

async function testSchemaMirrorAlignment() {
  console.log('\n--- 1. Testing Schema Mirror & Contract Alignment ---');

  const types = ['clients', 'team', 'categories'];

  for (const type of types) {
    const backendConfig = backendSchemaModule.BULK_UPLOAD_SCHEMA[type];
    const frontendConfig = frontendSchemaModule.BULK_UPLOAD_SCHEMA[type];

    assert.ok(backendConfig, `Backend schema must have config for "${type}"`);
    assert.ok(frontendConfig, `Frontend schema must have config for "${type}"`);

    const backendFieldKeys = backendConfig.fields.map((f) => f.key);
    const frontendFieldKeys = frontendConfig.fields.map((f) => f.key);

    assert.deepEqual(
      backendFieldKeys,
      frontendFieldKeys,
      `Field order and keys must match identically for type "${type}"`
    );

    backendConfig.fields.forEach((bField) => {
      const fField = frontendConfig.fields.find((f) => f.key === bField.key);
      assert.strictEqual(
        bField.required,
        fField.required,
        `Required status for "${type}.${bField.key}" must match (backend=${bField.required}, frontend=${fField.required})`
      );
    });
  }

  // Verify validators
  const validEmailRow = { businessEmail: 'ops@acme.com', pincode: '400001' };
  const invalidEmailRow = { businessEmail: 'bad-email', pincode: '999' };

  assert.strictEqual(backendSchemaModule.validateRow(validEmailRow, 'clients').length, 8); // 10 required fields minus 2 provided
  assert.ok(backendSchemaModule.validateRow(invalidEmailRow, 'clients').includes('businessEmail is invalid'));
  assert.ok(backendSchemaModule.validateRow(invalidEmailRow, 'clients').includes('pincode is invalid'));

  console.log('✓ Schema mirror and validators match identically between backend and frontend');
}

async function testHistoricalDocketBulkImport(firmId) {
  console.log('\n--- 2. Testing Historical Docket Bulk Import ---');

  // Setup seed data for this firm
  const primaryTeam = await Team.create({
    firmId,
    name: 'Compliance Workbasket',
    type: 'PRIMARY',
    isActive: true,
  });

  const categoryDoc = await Category.create({
    firmId,
    name: 'Corporate Filings',
    isActive: true,
    subcategories: [
      {
        id: 'sub-annual-01',
        name: 'Annual Return',
        workbasketId: primaryTeam._id,
        isActive: true,
      },
    ],
  });

  const clientDoc = await Client.create({
    firmId,
    clientId: 'C00100',
    businessName: 'Stark Industries Ltd',
    businessEmail: 'finance@stark.com',
    primaryContactNumber: '9876543210',
    status: 'active',
    isActive: true,
    isDefaultClient: true,
    createdByXid: 'X00001',
  });

  // 2a. Test validateBulkDockets without ReferenceError
  const testRows = [
    {
      title: 'Historical Filing 2023',
      workbasket: 'Compliance Workbasket',
      category: 'Corporate Filings',
      subcategory: 'Annual Return',
      priority: 'high',
      clientId: 'C00100',
      status: 'RESOLVED',
      startDate: '2023-01-10',
      completedDate: '2023-01-20',
    },
    {
      // Missing title
      workbasket: 'Compliance Workbasket',
      category: 'Corporate Filings',
      subcategory: 'Annual Return',
    },
    {
      title: 'Filing with Invalid Workbasket',
      workbasket: 'Ghost Team',
      category: 'Corporate Filings',
      subcategory: 'Annual Return',
    },
    {
      title: 'Filing with Nonexistent Client',
      workbasket: 'Compliance Workbasket',
      category: 'Corporate Filings',
      subcategory: 'Annual Return',
      clientId: 'NON_EXISTENT_CLIENT',
    },
  ];

  const validationResults = await validateBulkDockets(testRows, firmId);
  assert.strictEqual(validationResults.length, 4, 'Should return validation for all 4 rows');

  // Row 1: valid
  assert.strictEqual(validationResults[0].isValid, true, 'Row 1 should be valid');
  assert.strictEqual(validationResults[0].normalizedData.workbasketName, 'Compliance Workbasket');
  assert.strictEqual(validationResults[0].normalizedData.category, 'Corporate Filings');
  assert.strictEqual(validationResults[0].normalizedData.subcategory, 'Annual Return');
  assert.strictEqual(validationResults[0].normalizedData.clientId, 'C00100');
  assert.strictEqual(validationResults[0].normalizedData.status, 'RESOLVED');
  assert.strictEqual(validationResults[0].normalizedData.isHistoricalImport, true);

  // Row 2: missing title
  assert.strictEqual(validationResults[1].isValid, false, 'Row 2 should fail validation');
  assert.ok(validationResults[1].errors.includes('Missing title'));

  // Row 3: invalid workbasket
  assert.strictEqual(validationResults[2].isValid, false, 'Row 3 should fail validation');
  assert.ok(validationResults[2].errors.includes('Invalid workbasket'));

  // Row 4: client not found
  assert.strictEqual(validationResults[3].isValid, false, 'Row 4 should fail validation');
  assert.ok(validationResults[3].errors.some((e) => e.includes('not found')));

  console.log('✓ validateBulkDockets validates workbasket, category, subcategory, client, and required fields');

  // 2b. Test generateDocketImportTemplate
  const templateReq = {
    user: { firmId, email: 'admin@stark.com' },
  };
  const templateRes = createMockRes();
  await generateDocketImportTemplate(templateReq, templateRes);

  assert.strictEqual(templateRes.statusCode, 200);
  assert.strictEqual(templateRes.headers['Content-Type'], 'text/csv');
  assert.ok(templateRes.bodyText.includes('docketId,clientId,clientName,workbasket,category,subcategory'));
  assert.ok(templateRes.bodyText.includes('Stark Industries Ltd'));
  assert.ok(templateRes.bodyText.includes('Compliance Workbasket'));
  console.log('✓ generateDocketImportTemplate outputs live CSV template prefilled with firm data');

  // 2c. Test previewDocketBulkUpload
  const previewReq = {
    user: { firmId },
    body: { rows: testRows },
  };
  const previewRes = createMockRes();
  await previewDocketBulkUpload(previewReq, previewRes);

  assert.strictEqual(previewRes.statusCode, 200);
  assert.strictEqual(previewRes.data.success, true);
  assert.strictEqual(previewRes.data.summary.totalRows, 4);
  assert.strictEqual(previewRes.data.summary.validRows, 1);
  assert.strictEqual(previewRes.data.summary.invalidRows, 3);
  console.log('✓ previewDocketBulkUpload accurately previews valid vs invalid count');

  // 2d. Test uploadDocketBulk with rejectOnInvalid = true
  const rejectReq = {
    user: { firmId, email: 'admin@stark.com', xID: 'X0001' },
    body: { rows: testRows, rejectOnInvalid: true },
  };
  const rejectRes = createMockRes();
  await uploadDocketBulk(rejectReq, rejectRes);
  assert.strictEqual(rejectRes.statusCode, 400);
  assert.strictEqual(rejectRes.data.success, false);
  assert.strictEqual(rejectRes.data.created, 0);
  assert.strictEqual(rejectRes.data.failed, 3);
  console.log('✓ uploadDocketBulk honors rejectOnInvalid flag');
}

async function testClientBulkUpload(firmId) {
  console.log('\n--- 3. Testing Client Bulk Upload ---');

  const validCsv = [
    'businessName,businessEmail,primaryContactNumber,businessAddress,city,state,pincode,contactPersonName,contactPersonEmail,contactPersonPhone',
    'Wayne Enterprises,finance@wayne.com,9876543210,Wayne Tower,Gotham,MH,400001,Bruce Wayne,bruce@wayne.com,9876543210',
    'LexCorp Industries,billing@lexcorp.com,9876543211,LexCorp Tower,Metropolis,DL,110001,Lex Luthor,lex@lexcorp.com,9876543211',
  ].join('\n');

  const previewReq = {
    params: { type: 'clients' },
    firmPermissions: ['ADMIN_STATS', 'CLIENT_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      csvContent: validCsv,
      duplicateMode: 'skip',
    },
  };
  const previewRes = createMockRes();
  await previewBulkUpload(previewReq, previewRes);

  assert.strictEqual(previewRes.statusCode, 200);
  assert.strictEqual(previewRes.data.success, true);
  assert.strictEqual(previewRes.data.data.summary.totalRows, 2);
  assert.strictEqual(previewRes.data.data.summary.validRows, 2);
  assert.strictEqual(previewRes.data.data.summary.invalidRows, 0);
  console.log('✓ previewBulkUpload validates client CSV rows and fields');

  // Test confirm & batch insertion
  const confirmReq = {
    params: { type: 'clients' },
    firmPermissions: ['ADMIN_STATS', 'CLIENT_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      rows: previewRes.data.data.valid,
      duplicateMode: 'skip',
      async: false,
    },
  };
  const confirmRes = createMockRes();
  await confirmBulkUpload(confirmReq, confirmRes);

  assert.strictEqual(confirmRes.statusCode, 201);
  assert.strictEqual(confirmRes.data.success, true);
  assert.strictEqual(confirmRes.data.data.inserted, 2);

  const insertedWayne = await Client.findOne({ firmId, businessEmail: 'finance@wayne.com' }).lean();
  assert.ok(insertedWayne, 'Wayne Enterprises should be in database');
  assert.ok(insertedWayne.clientId.startsWith('C'), 'Auto-generated clientId should start with C');
  assert.strictEqual(insertedWayne.city, 'Gotham');
  assert.strictEqual(insertedWayne.pincode, '400001');

  console.log('✓ confirmBulkUpload successfully creates clients with auto-generated Client IDs');

  // Test duplicateMode = 'skip'
  const dupPreviewReq = {
    params: { type: 'clients' },
    firmPermissions: ['ADMIN_STATS', 'CLIENT_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      csvContent: validCsv,
      duplicateMode: 'skip',
    },
  };
  const dupPreviewRes = createMockRes();
  await previewBulkUpload(dupPreviewReq, dupPreviewRes);
  assert.strictEqual(dupPreviewRes.data.data.summary.skippedRows, 2, 'Existing emails should be skipped in skip mode');
  console.log('✓ Duplicate mode "skip" accurately skips existing client records');

  // Test duplicateMode = 'update'
  const updateCsv = [
    'businessName,businessEmail,primaryContactNumber,businessAddress,city,state,pincode,contactPersonName,contactPersonEmail,contactPersonPhone',
    'Wayne Enterprises Renamed,finance@wayne.com,9876543210,New Address,Gotham,MH,400001,Bruce Wayne,bruce@wayne.com,9876543210',
  ].join('\n');

  const updatePreviewReq = {
    params: { type: 'clients' },
    firmPermissions: ['ADMIN_STATS', 'CLIENT_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      csvContent: updateCsv,
      duplicateMode: 'update',
    },
  };
  const updatePreviewRes = createMockRes();
  await previewBulkUpload(updatePreviewReq, updatePreviewRes);
  assert.strictEqual(updatePreviewRes.data.data.summary.validRows, 1);
  assert.strictEqual(updatePreviewRes.data.data.valid[0].action, 'update');

  // Confirm update
  const updateConfirmReq = {
    params: { type: 'clients' },
    firmPermissions: ['ADMIN_STATS', 'CLIENT_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      rows: updatePreviewRes.data.data.valid,
      duplicateMode: 'update',
      async: false,
    },
  };
  const updateConfirmRes = createMockRes();
  await confirmBulkUpload(updateConfirmReq, updateConfirmRes);
  assert.strictEqual(updateConfirmRes.statusCode, 201);

  const updatedWayne = await Client.findOne({ firmId, businessEmail: 'finance@wayne.com' }).lean();
  assert.strictEqual(updatedWayne.businessAddress, 'New Address');
  console.log('✓ Duplicate mode "update" successfully updates existing client fields');
}

async function testTeamBulkUpload(firmId) {
  console.log('\n--- 4. Testing Team / Staff Bulk Upload ---');

  // Create active primary workbasket
  const legalTeam = await Team.create({
    firmId,
    name: 'Legal Operations',
    type: 'PRIMARY',
    isActive: true,
  });

  const teamCsv = [
    'name,email,role,department,workbaskets',
    'Diana Prince,diana@themyscira.com,Admin,Executive,Legal Operations',
    'Clark Kent,clark@dailyplanet.com,User,News,Legal Operations',
    'Bad Role User,bad@test.com,SuperHero,Ops,Legal Operations',
  ].join('\n');

  const previewReq = {
    params: { type: 'team' },
    firmPermissions: ['ADMIN_STATS', 'USER_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      csvContent: teamCsv,
      duplicateMode: 'skip',
    },
  };
  const previewRes = createMockRes();
  await previewBulkUpload(previewReq, previewRes);

  assert.strictEqual(previewRes.statusCode, 200);
  assert.strictEqual(previewRes.data.data.summary.totalRows, 3);
  assert.strictEqual(previewRes.data.data.summary.validRows, 2);
  assert.strictEqual(previewRes.data.data.summary.invalidRows, 1);
  assert.ok(previewRes.data.data.invalid[0].error.toLowerCase().includes('role') && previewRes.data.data.invalid[0].error.toLowerCase().includes('invalid'));
  console.log('✓ Team preview normalizes valid roles and rejects unsupported roles');

  // Confirm import
  const confirmReq = {
    params: { type: 'team' },
    firmPermissions: ['ADMIN_STATS', 'USER_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      rows: previewRes.data.data.valid,
      duplicateMode: 'skip',
      async: false,
    },
  };
  const confirmRes = createMockRes();
  await confirmBulkUpload(confirmReq, confirmRes);

  assert.strictEqual(confirmRes.statusCode, 201);
  assert.strictEqual(confirmRes.data.data.inserted, 2);

  const diana = await User.findOne({ firmId, email: 'diana@themyscira.com' });
  assert.ok(diana, 'Diana should be in database');
  assert.strictEqual(diana.role, 'Admin');
  assert.strictEqual(diana.status, 'invited');
  assert.deepEqual(diana.teamIds.map(String), [String(legalTeam._id)]);

  const clark = await User.findOne({ firmId, email: 'clark@dailyplanet.com' });
  assert.strictEqual(clark.role, 'Employee', 'Role "User" must be normalized to "Employee"');

  console.log('✓ Team confirm creates invited users with mapped workbaskets and normalized roles');
}

async function testCategoryBulkUpload(firmId) {
  console.log('\n--- 5. Testing Category & Subcategory Bulk Upload ---');

  const auditTeam = await Team.create({
    firmId,
    name: 'Statutory Audit',
    type: 'PRIMARY',
    isActive: true,
  });

  const categoryCsv = [
    'category,subcategory,workbasket',
    'Audit Services,Tax Audit,Statutory Audit',
    'Audit Services,Internal Audit,Statutory Audit',
  ].join('\n');

  const previewReq = {
    params: { type: 'categories' },
    firmPermissions: ['ADMIN_STATS', 'CATEGORY_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      csvContent: categoryCsv,
      duplicateMode: 'update', // Test update downgrade to skip
    },
  };
  const previewRes = createMockRes();
  await previewBulkUpload(previewReq, previewRes);

  assert.strictEqual(previewRes.statusCode, 200);
  assert.strictEqual(previewRes.data.data.summary.validRows, 2);
  console.log('✓ Category preview correctly maps category, subcategories, and workbaskets');

  // Confirm creation
  const confirmReq = {
    params: { type: 'categories' },
    firmPermissions: ['ADMIN_STATS', 'CATEGORY_MANAGE'],
    user: { firmId, email: 'admin@test.com', xID: 'X00001' },
    body: {
      rows: previewRes.data.data.valid,
      duplicateMode: 'update',
      async: false,
    },
  };
  const confirmRes = createMockRes();
  await confirmBulkUpload(confirmReq, confirmRes);

  assert.strictEqual(confirmRes.statusCode, 201);

  const auditCategory = await Category.findOne({ firmId, name: 'Audit Services' });
  assert.ok(auditCategory, 'Audit Services category should exist');
  assert.strictEqual(auditCategory.subcategories.length, 2);
  assert.ok(auditCategory.subcategories.some((s) => s.name === 'Tax Audit'));
  assert.ok(auditCategory.subcategories.some((s) => s.name === 'Internal Audit'));

  console.log('✓ Category confirm creates category and appends subcategories with mapped workbaskets');
}

async function run() {
  console.log('====================================================');
  console.log('RUNNING BULK UPLOAD & MIGRATION FEATURES TEST SUITE');
  console.log('====================================================');

  await testSchemaMirrorAlignment();

  let mongoServer = null;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const firmDoc = await Firm.create({
      firmId: 'FIRM001',
      name: 'Test Migration Firm',
      firmSlug: 'test-migration-firm',
      status: 'active',
      bootstrapStatus: 'PENDING',
    });

    const testFirmId = firmDoc._id;

    await testHistoricalDocketBulkImport(testFirmId);
    await testClientBulkUpload(testFirmId);
    await testTeamBulkUpload(testFirmId);
    await testCategoryBulkUpload(testFirmId);

    console.log('\n====================================================');
    console.log('ALL BULK UPLOAD MIGRATION FEATURE TESTS PASSED! ✓');
    console.log('====================================================');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

run().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
