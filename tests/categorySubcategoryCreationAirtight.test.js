#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-12345678901234567890';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000000';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@docketra.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '507f1f77bcf86cd799439011';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.MASTER_ENCRYPTION_KEY = '0'.repeat(64);

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Firm = require('../src/models/Firm.model');
const Team = require('../src/models/Team.model');
const Category = require('../src/models/Category.model');
const Case = require('../src/models/Case.model');

const { createPrimaryWithQc } = require('../src/services/workbasketGuardrails.service');
const { validateCategoryMappedWorkbasket } = require('../src/services/categoryWorkbasketValidation.service');
const { ensureDefaultRoutingForFirm } = require('../src/services/defaultRouting.service');
const { setupDefaultFirm } = require('../src/services/firmSetup.service');
const categoryController = require('../src/controllers/category.controller');
const { previewBulkUpload, confirmBulkUpload } = require('../src/controllers/bulkUpload.controller');
const adminSchemas = require('../src/schemas/admin.routes.schema');
const categorySchemas = require('../src/schemas/category.routes.schema');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');

const makeRes = () => ({
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
});

const runValidationMiddleware = (schema, req) => new Promise((resolve) => {
  const middleware = validateRequest(schema);
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ ok: false, statusCode: this.statusCode, body: payload }); },
  };
  middleware(req, res, () => resolve({ ok: true, req }));
});

async function runTests() {
  let mongoServer = null;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const firmA = await Firm.create({
      firmId: 'FIRM001',
      name: 'Firm Alpha LLP',
      firmSlug: 'firm-alpha-llp',
      status: 'active',
      defaultClientId: new mongoose.Types.ObjectId(),
    });
    const firmB = await Firm.create({
      firmId: 'FIRM002',
      name: 'Firm Beta LLP',
      firmSlug: 'firm-beta-llp',
      status: 'active',
      defaultClientId: new mongoose.Types.ObjectId(),
    });

    const userA = {
      _id: new mongoose.Types.ObjectId(),
      firmId: firmA._id,
      role: 'ADMIN',
      xID: 'X000010',
      email: 'admin@firma.com',
    };

    const { primary: wbTax, qc: qcTax } = await createPrimaryWithQc({
      firmId: firmA._id,
      name: 'Direct Tax',
    });
    const { primary: wbRoc, qc: qcRoc } = await createPrimaryWithQc({
      firmId: firmA._id,
      name: 'Company Law',
    });
    const { primary: wbInactive, qc: qcInactive } = await createPrimaryWithQc({
      firmId: firmA._id,
      name: 'Dormant WB',
    });
    await Team.updateMany({ _id: { $in: [wbInactive._id, qcInactive._id] } }, { $set: { isActive: false } });

    const { primary: wbBrokenQc, qc: qcBroken } = await createPrimaryWithQc({
      firmId: firmA._id,
      name: 'Broken QC WB',
    });
    await Team.updateOne({ _id: qcBroken._id }, { $set: { isActive: false } });

    const { primary: wbLegacyNoQc } = {
      primary: await Team.create({
        firmId: firmA._id,
        name: 'Legacy Direct WB',
        type: 'PRIMARY',
        isActive: true,
      }),
    };

    const { primary: wbFirmB, qc: qcFirmB } = await createPrimaryWithQc({
      firmId: firmB._id,
      name: 'Beta Tax',
    });

    // 1. Validation service checks (primary WB + linked QC WB)
    {
      const invalidIdRes = await validateCategoryMappedWorkbasket({ workbasketId: 'not-an-id', firmId: firmA._id });
      assert.strictEqual(invalidIdRes.valid, false);

      const qcAsPrimaryRes = await validateCategoryMappedWorkbasket({ workbasketId: qcTax._id, firmId: firmA._id });
      assert.strictEqual(qcAsPrimaryRes.valid, false);

      const inactiveWbRes = await validateCategoryMappedWorkbasket({ workbasketId: wbInactive._id, firmId: firmA._id });
      assert.strictEqual(inactiveWbRes.valid, false);

      const crossFirmWbRes = await validateCategoryMappedWorkbasket({ workbasketId: wbFirmB._id, firmId: firmA._id });
      assert.strictEqual(crossFirmWbRes.valid, false);

      const inactiveQcRes = await validateCategoryMappedWorkbasket({ workbasketId: wbBrokenQc._id, firmId: firmA._id });
      assert.strictEqual(inactiveQcRes.valid, false);
      assert.match(inactiveQcRes.message, /linked qc workbasket/i);

      // Mismatched explicit qcWorkbasketId (belongs to wbRoc instead of wbTax)
      const mismatchedQcRes = await validateCategoryMappedWorkbasket({
        workbasketId: wbTax._id,
        qcWorkbasketId: qcRoc._id,
        firmId: firmA._id,
      });
      assert.strictEqual(mismatchedQcRes.valid, false);

      // Primary WB passed as qcWorkbasketId
      const primaryAsQcRes = await validateCategoryMappedWorkbasket({
        workbasketId: wbTax._id,
        qcWorkbasketId: wbTax._id,
        firmId: firmA._id,
      });
      assert.strictEqual(primaryAsQcRes.valid, false);

      // Cross-firm QC WB rejected
      const crossFirmQcRes = await validateCategoryMappedWorkbasket({
        workbasketId: wbTax._id,
        qcWorkbasketId: qcFirmB._id,
        firmId: firmA._id,
      });
      assert.strictEqual(crossFirmQcRes.valid, false);

      // Legacy primary WB auto-heals missing QC workbasket in active DB
      const healedRes = await validateCategoryMappedWorkbasket({
        workbasketId: wbLegacyNoQc._id,
        firmId: firmA._id,
      });
      assert.strictEqual(healedRes.valid, true);
      assert.strictEqual(String(healedRes.workbasket._id), String(wbLegacyNoQc._id));
      assert.ok(healedRes.qcWorkbasket?._id, 'Legacy primary WB must auto-ensure linked QC workbasket');
      assert.strictEqual(String(healedRes.qcWorkbasket.parentWorkbasketId), String(wbLegacyNoQc._id));

      // Valid primary + matching QC WB succeeds
      const okRes = await validateCategoryMappedWorkbasket({
        workbasketId: wbTax._id,
        qcWorkbasketId: qcTax._id,
        firmId: firmA._id,
      });
      assert.strictEqual(okRes.valid, true);
      assert.strictEqual(String(okRes.qcWorkbasket._id), String(qcTax._id));
      console.log('✓ 1. Workbasket + QC workbasket validation checks passed');
    }

    // 2. Route schema contracts (admin + legacy category routes)
    {
      const validCat = await runValidationMiddleware(adminSchemas['POST /categories'], {
        body: { name: 'Taxation', workbasketId: String(wbTax._id), qcWorkbasketId: String(qcTax._id) },
        params: {},
        query: {},
      });
      assert.strictEqual(validCat.ok, true);

      const strictReject = await runValidationMiddleware(adminSchemas['POST /categories'], {
        body: { name: 'Taxation', workbasketId: String(wbTax._id), extraBadField: true },
        params: {},
        query: {},
      });
      assert.strictEqual(strictReject.ok, false);

      const validSub = await runValidationMiddleware(categorySchemas['POST /:id/subcategories'], {
        body: { name: 'ITR Filing', workbasketId: String(wbTax._id), qcWorkbasketId: String(qcTax._id) },
        params: { id: String(new mongoose.Types.ObjectId()) },
        query: {},
      });
      assert.strictEqual(validSub.ok, true);
      console.log('✓ 2. Route validation schemas accept workbasketId & qcWorkbasketId safely');
    }

    // 3. Category creation: negative & happy paths
    let createdCategoryId = null;
    {
      // Missing firm context -> 403
      const noFirmRes = makeRes();
      await categoryController.createCategory(
        { body: { name: 'Audit', workbasketId: String(wbTax._id) }, user: { role: 'ADMIN', xID: 'X1' } },
        noFirmRes,
      );
      assert.strictEqual(noFirmRes.statusCode, 403);

      // Missing workbasketId -> 400
      const noWbRes = makeRes();
      await categoryController.createCategory({ body: { name: 'Audit' }, user: userA }, noWbRes);
      assert.strictEqual(noWbRes.statusCode, 400);

      // Blank/whitespace name -> 400
      const blankNameRes = makeRes();
      await categoryController.createCategory(
        { body: { name: '   ', workbasketId: String(wbTax._id) }, user: userA },
        blankNameRes,
      );
      assert.strictEqual(blankNameRes.statusCode, 400);

      // Reject QC WB passed as workbasketId -> 400
      const qcPrimaryRes = makeRes();
      await categoryController.createCategory(
        { body: { name: 'Audit', workbasketId: String(qcTax._id) }, user: userA },
        qcPrimaryRes,
      );
      assert.strictEqual(qcPrimaryRes.statusCode, 400);

      // Reject primary WB with inactive linked QC WB -> 400
      const brokenQcRes = makeRes();
      await categoryController.createCategory(
        { body: { name: 'Audit', workbasketId: String(wbBrokenQc._id) }, user: userA },
        brokenQcRes,
      );
      assert.strictEqual(brokenQcRes.statusCode, 400);

      // Reject mismatched qcWorkbasketId -> 400
      const mismatchRes = makeRes();
      await categoryController.createCategory(
        { body: { name: 'Audit', workbasketId: String(wbTax._id), qcWorkbasketId: String(qcRoc._id) }, user: userA },
        mismatchRes,
      );
      assert.strictEqual(mismatchRes.statusCode, 400);

      // Create valid category linked to WB + QC WB
      const okRes = makeRes();
      await categoryController.createCategory(
        {
          body: {
            name: '  Income   Tax  ',
            workbasketId: String(wbTax._id),
            defaultSlaDays: 4,
            qcPercent: 25,
          },
          user: userA,
        },
        okRes,
      );
      assert.strictEqual(okRes.statusCode, 201);
      assert.strictEqual(okRes.body.data.name, 'Income Tax');
      assert.strictEqual(String(okRes.body.data.workbasketId), String(wbTax._id));
      assert.strictEqual(String(okRes.body.data.qcWorkbasketId), String(qcTax._id));
      createdCategoryId = okRes.body.data._id;

      // Duplicate case/whitespace collision -> 409
      const dupRes = makeRes();
      await categoryController.createCategory(
        { body: { name: 'income tax', workbasketId: String(wbTax._id) }, user: userA },
        dupRes,
      );
      assert.strictEqual(dupRes.statusCode, 409);

      // Different firm can create same category name with its own WB + QC WB
      const crossFirmOk = makeRes();
      await categoryController.createCategory(
        {
          body: { name: 'Income Tax', workbasketId: String(wbFirmB._id) },
          user: { _id: new mongoose.Types.ObjectId(), firmId: firmB._id, role: 'ADMIN', xID: 'XB1' },
        },
        crossFirmOk,
      );
      assert.strictEqual(crossFirmOk.statusCode, 201);
      assert.strictEqual(String(crossFirmOk.body.data.workbasketId), String(wbFirmB._id));
      assert.strictEqual(String(crossFirmOk.body.data.qcWorkbasketId), String(qcFirmB._id));

      console.log('✓ 3. Category creation enforces WB + QC WB linking, tenant isolation, and duplicate protection');
    }

    // 4. Category update: negative & happy paths
    {
      const { primary: wbAlt } = { primary: wbRoc };
      await categoryController.createCategory(
        { body: { name: 'Secretarial', workbasketId: String(wbRoc._id) }, user: userA },
        makeRes(),
      );

      // Rename collision -> 409
      const dupRenameRes = makeRes();
      await categoryController.updateCategory(
        { params: { id: String(createdCategoryId) }, body: { name: 'secretarial', workbasketId: String(wbTax._id) }, user: userA },
        dupRenameRes,
      );
      assert.strictEqual(dupRenameRes.statusCode, 409);

      // Invalid WB rejected on update -> 400
      const badWbUpdateRes = makeRes();
      await categoryController.updateCategory(
        { params: { id: String(createdCategoryId) }, body: { name: 'Income Tax', workbasketId: String(qcTax._id) }, user: userA },
        badWbUpdateRes,
      );
      assert.strictEqual(badWbUpdateRes.statusCode, 400);

      // Re-link category to wbAlt (Company Law + Company Law — QC)
      const okUpdateRes = makeRes();
      await categoryController.updateCategory(
        { params: { id: String(createdCategoryId) }, body: { name: 'Income Tax & TDS', workbasketId: String(wbAlt._id) }, user: userA },
        okUpdateRes,
      );
      assert.strictEqual(okUpdateRes.statusCode, 200);
      assert.strictEqual(okUpdateRes.body.data.name, 'Income Tax & TDS');
      assert.strictEqual(String(okUpdateRes.body.data.workbasketId), String(wbRoc._id));
      assert.strictEqual(String(okUpdateRes.body.data.qcWorkbasketId), String(qcRoc._id));

      // Cross-firm category update -> 404
      const crossFirmCatRes = makeRes();
      await categoryController.updateCategory(
        {
          params: { id: String(createdCategoryId) },
          body: { name: 'Hijack', workbasketId: String(wbFirmB._id) },
          user: { _id: new mongoose.Types.ObjectId(), firmId: firmB._id, role: 'ADMIN', xID: 'XB1' },
        },
        crossFirmCatRes,
      );
      assert.strictEqual(crossFirmCatRes.statusCode, 404);
      console.log('✓ 4. Category update re-links WB + QC WB cleanly and preserves firm isolation');
    }

    // 5. Subcategory creation & update + unassigned IN_WB docket migration
    {
      // Missing WB -> 400
      const noSubWbRes = makeRes();
      await categoryController.addSubcategory(
        { params: { id: String(createdCategoryId) }, body: { name: 'TDS 26Q' }, user: userA },
        noSubWbRes,
      );
      assert.strictEqual(noSubWbRes.statusCode, 400);

      // Inactive QC WB rejected -> 400
      const brokenQcSubRes = makeRes();
      await categoryController.addSubcategory(
        { params: { id: String(createdCategoryId) }, body: { name: 'TDS 26Q', workbasketId: String(wbBrokenQc._id) }, user: userA },
        brokenQcSubRes,
      );
      assert.strictEqual(brokenQcSubRes.statusCode, 400);

      // Cross-firm category -> 404
      const crossCatSubRes = makeRes();
      await categoryController.addSubcategory(
        {
          params: { id: String(createdCategoryId) },
          body: { name: 'TDS 26Q', workbasketId: String(wbFirmB._id) },
          user: { _id: new mongoose.Types.ObjectId(), firmId: firmB._id, role: 'ADMIN', xID: 'XB1' },
        },
        crossCatSubRes,
      );
      assert.strictEqual(crossCatSubRes.statusCode, 404);

      // Add valid subcategory linked to wbTax + qcTax
      const addSubRes = makeRes();
      await categoryController.addSubcategory(
        {
          params: { id: String(createdCategoryId) },
          body: {
            name: '  TDS   Quarterly Return  ',
            workbasketId: String(wbTax._id),
            qcWorkbasketId: String(qcTax._id),
            defaultSlaDays: 3,
            qcPercent: 100,
          },
          user: userA,
        },
        addSubRes,
      );
      assert.strictEqual(addSubRes.statusCode, 201);
      const addedSub = addSubRes.body.data.subcategories.find((s) => s.name === 'TDS Quarterly Return');
      assert.ok(addedSub);
      assert.strictEqual(String(addedSub.workbasketId), String(wbTax._id));
      assert.strictEqual(String(addedSub.qcWorkbasketId), String(qcTax._id));

      // Duplicate subcategory (case/whitespace) -> 409
      const dupSubRes = makeRes();
      await categoryController.addSubcategory(
        {
          params: { id: String(createdCategoryId) },
          body: { name: 'tds quarterly return', workbasketId: String(wbTax._id) },
          user: userA,
        },
        dupSubRes,
      );
      assert.strictEqual(dupSubRes.statusCode, 409);

      // Seed 2 dockets to verify only unassigned IN_WB moves when subcategory WB changes
      await Case.create([
        {
          caseId: 'CASE-SUB-001',
          caseName: 'Unassigned WB docket',
          title: 'Unassigned WB docket',
          description: 'test',
          clientId: 'C000001',
          slaDueAt: new Date(Date.now() + 86400000),
          idempotencyKey: 'case-sub-001',
          categoryId: createdCategoryId,
          subcategoryId: addedSub.id,
          category: 'Income Tax & TDS',
          caseCategory: 'Income Tax & TDS',
          firmId: firmA._id,
          createdByXID: 'X000010',
          status: 'UNASSIGNED',
          state: 'IN_WB',
          ownerTeamId: wbTax._id,
          workbasketId: wbTax._id,
          assignedToXID: null,
        },
        {
          caseId: 'CASE-SUB-002',
          caseName: 'Assigned active docket',
          title: 'Assigned active docket',
          description: 'test',
          clientId: 'C000001',
          slaDueAt: new Date(Date.now() + 86400000),
          idempotencyKey: 'case-sub-002',
          categoryId: createdCategoryId,
          subcategoryId: addedSub.id,
          category: 'Income Tax & TDS',
          caseCategory: 'Income Tax & TDS',
          firmId: firmA._id,
          createdByXID: 'X000010',
          status: 'ASSIGNED',
          state: 'IN_PROGRESS',
          ownerTeamId: wbTax._id,
          workbasketId: wbTax._id,
          assignedToXID: 'X000020',
        },
      ]);

      // Reject update with mismatched QC WB
      const badQcUpdateSub = makeRes();
      await categoryController.updateSubcategory(
        {
          params: { id: String(createdCategoryId), subcategoryId: addedSub.id },
          body: { name: 'TDS Quarterly Return', workbasketId: String(wbRoc._id), qcWorkbasketId: String(qcTax._id) },
          user: userA,
        },
        badQcUpdateSub,
      );
      assert.strictEqual(badQcUpdateSub.statusCode, 400);

      // Valid update re-linking subcategory to wbRoc + qcRoc
      const okSubUpdate = makeRes();
      await categoryController.updateSubcategory(
        {
          params: { id: String(createdCategoryId), subcategoryId: addedSub.id },
          body: { name: 'TDS Form 26Q', workbasketId: String(wbRoc._id) },
          user: userA,
        },
        okSubUpdate,
      );
      assert.strictEqual(okSubUpdate.statusCode, 200);
      const updatedSub = okSubUpdate.body.data.subcategories.find((s) => s.id === addedSub.id);
      assert.strictEqual(updatedSub.name, 'TDS Form 26Q');
      assert.strictEqual(String(updatedSub.workbasketId), String(wbRoc._id));
      assert.strictEqual(String(updatedSub.qcWorkbasketId), String(qcRoc._id));

      const movedDocket = await Case.findOne({ caseId: 'CASE-SUB-001', firmId: firmA._id }).lean();
      const untouchedDocket = await Case.findOne({ caseId: 'CASE-SUB-002', firmId: firmA._id }).lean();
      assert.strictEqual(String(movedDocket.workbasketId), String(wbRoc._id));
      assert.strictEqual(String(untouchedDocket.workbasketId), String(wbTax._id));
      console.log('✓ 5. Subcategory create/update enforces WB + QC WB and safely migrates unassigned dockets');
    }

    // 6. Bulk CSV import validates QC WB and persists WB + QC WB on categories & subcategories
    {
      const csv = [
        'category,subcategory,workbasket',
        'Advisory,Legal Opinion,Direct Tax',
        'AdvisoryOnly,,Company Law',
        'BadInactiveQc,Sub,Broken QC WB',
        'BadDirectQc,Sub,Direct Tax — QC',
      ].join('\n');

      const prevRes = makeRes();
      await previewBulkUpload(
        {
          params: { type: 'categories' },
          firmPermissions: ['ADMIN_STATS', 'CATEGORY_MANAGE'],
          user: userA,
          body: { csvContent: csv, duplicateMode: 'skip' },
        },
        prevRes,
      );
      assert.strictEqual(prevRes.statusCode, 200);
      assert.strictEqual(prevRes.body.data.summary.validRows, 2);
      assert.strictEqual(prevRes.body.data.summary.invalidRows, 2);

      const confRes = makeRes();
      await confirmBulkUpload(
        {
          params: { type: 'categories' },
          firmPermissions: ['ADMIN_STATS', 'CATEGORY_MANAGE'],
          user: userA,
          body: { rows: prevRes.body.data.valid, duplicateMode: 'skip', async: false },
        },
        confRes,
      );
      assert.strictEqual(confRes.statusCode, 201);

      const advisoryCat = await Category.findOne({ firmId: firmA._id, name: 'Advisory' }).lean();
      assert.strictEqual(String(advisoryCat.workbasketId), String(wbTax._id));
      assert.strictEqual(String(advisoryCat.qcWorkbasketId), String(qcTax._id));
      assert.strictEqual(String(advisoryCat.subcategories[0].workbasketId), String(wbTax._id));
      assert.strictEqual(String(advisoryCat.subcategories[0].qcWorkbasketId), String(qcTax._id));

      const catOnly = await Category.findOne({ firmId: firmA._id, name: 'AdvisoryOnly' }).lean();
      assert.strictEqual(String(catOnly.workbasketId), String(wbRoc._id));
      assert.strictEqual(String(catOnly.qcWorkbasketId), String(qcRoc._id));
      console.log('✓ 6. Category bulk upload validates QC WB and persists WB + QC WB on categories & subcategories');
    }

    // 7. Default routing & firm onboarding setup link BOTH WB and QC WB
    {
      const firmC = await Firm.create({
        firmId: 'FIRM003',
        name: 'Firm Gamma LLP',
        firmSlug: 'firm-gamma-llp',
        status: 'active',
        defaultClientId: new mongoose.Types.ObjectId(),
      });
      await setupDefaultFirm(firmC._id, { _id: new mongoose.Types.ObjectId(), xID: 'XC001' });
      const seededCategories = await Category.find({ firmId: firmC._id }).lean();
      assert.ok(seededCategories.length > 0);
      for (const cat of seededCategories) {
        assert.ok(cat.workbasketId, `Seeded category ${cat.name} must link a primary workbasket`);
        assert.ok(cat.qcWorkbasketId, `Seeded category ${cat.name} must link a QC workbasket`);
        for (const sub of cat.subcategories || []) {
          assert.ok(sub.workbasketId, `Seeded subcategory ${sub.name} must link a primary workbasket`);
          assert.ok(sub.qcWorkbasketId, `Seeded subcategory ${sub.name} must link a QC workbasket`);
        }
      }

      const firmD = await Firm.create({
        firmId: 'FIRM004',
        name: 'Firm Delta LLP',
        firmSlug: 'firm-delta-llp',
        status: 'active',
        defaultClientId: new mongoose.Types.ObjectId(),
      });
      const defaultResult = await ensureDefaultRoutingForFirm(firmD._id);
      assert.ok(defaultResult.defaultWorkbasketId);
      assert.ok(defaultResult.defaultQcWorkbasketId);
      const defaultCat = await Category.findOne({ firmId: firmD._id, name: 'General' }).lean();
      assert.strictEqual(String(defaultCat.workbasketId), defaultResult.defaultWorkbasketId);
      assert.strictEqual(String(defaultCat.qcWorkbasketId), defaultResult.defaultQcWorkbasketId);
      assert.strictEqual(String(defaultCat.subcategories[0].workbasketId), defaultResult.defaultWorkbasketId);
      assert.strictEqual(String(defaultCat.subcategories[0].qcWorkbasketId), defaultResult.defaultQcWorkbasketId);
      console.log('✓ 7. Firm setup & default routing link WB + QC WB on every category and subcategory');
    }

    console.log('\nALL AIRTIGHT CATEGORY & SUBCATEGORY WORKBASKET LINKING TESTS PASSED!');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('Airtight category & subcategory tests failed:', err);
  process.exit(1);
});
