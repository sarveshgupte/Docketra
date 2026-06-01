const assert = require('assert');
const dashboardService = require('../src/services/dashboard.service');
const complianceTemplateGenerationService = require('../src/services/complianceTemplateGeneration.service');
const ComplianceObligationTemplate = require('../src/models/ComplianceObligationTemplate.model');

const createMockRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

const run = async () => {
  const original = {
    getComplianceControlRoom: dashboardService.getComplianceControlRoom,
    updateComplianceState: dashboardService.updateComplianceState,
    loadTemplates: complianceTemplateGenerationService.loadTemplates,
    previewOrGenerate: complianceTemplateGenerationService.previewOrGenerate,
    seedSampleTemplates: complianceTemplateGenerationService.seedSampleTemplates,
    createTemplate: ComplianceObligationTemplate.create,
    findOneAndUpdate: ComplianceObligationTemplate.findOneAndUpdate,
  };

  try {
    // Mock dashboard services
    dashboardService.getComplianceControlRoom = async () => ({ summary: {}, items: [] });
    dashboardService.updateComplianceState = async () => ({ caseId: 'CASE-001', compliance_state: 'filed' });

    // Mock template services
    complianceTemplateGenerationService.loadTemplates = async () => [];
    complianceTemplateGenerationService.previewOrGenerate = async () => ({ summary: {}, items: [] });
    complianceTemplateGenerationService.seedSampleTemplates = async () => ({ generated: 1 });
    ComplianceObligationTemplate.create = async (payload) => payload;
    ComplianceObligationTemplate.findOneAndUpdate = async () => ({ _id: 'T1' });

    // Load controllers
    delete require.cache[require.resolve('../src/controllers/dashboard.controller')];
    delete require.cache[require.resolve('../src/controllers/complianceTemplate.controller')];
    const dashboardController = require('../src/controllers/dashboard.controller');
    const templateController = require('../src/controllers/complianceTemplate.controller');

    // Roles categorizations
    const allRoles = ['USER', 'MANAGER', 'ADMIN', 'PRIMARY_ADMIN'];
    const adminRoles = ['ADMIN', 'PRIMARY_ADMIN'];
    const nonAdminRoles = ['USER', 'MANAGER'];

    // 1. Verify getComplianceControlRoom (CALENDAR VIEW) is open to ALL roles
    for (const role of allRoles) {
      const req = {
        user: { firmId: 'F1', role, xID: 'X1' },
        query: {},
        params: {},
        body: {},
      };
      const res = createMockRes();
      await dashboardController.getComplianceControlRoom(req, res);
      assert.strictEqual(res.statusCode, 200, `Role ${role} should be allowed to view control room`);
    }

    // 2. Verify updateComplianceState is restricted to ADMIN roles only
    for (const role of nonAdminRoles) {
      const req = {
        user: { firmId: 'F1', role, xID: 'X1' },
        params: { caseId: 'CASE-001' },
        body: { nextState: 'filed' },
      };
      const res = createMockRes();
      await dashboardController.updateComplianceState(req, res);
      assert.strictEqual(res.statusCode, 403, `Role ${role} should be blocked from updating compliance state`);
    }
    for (const role of adminRoles) {
      const req = {
        user: { firmId: 'F1', role, xID: 'X1' },
        params: { caseId: 'CASE-001' },
        body: { nextState: 'filed' },
      };
      const res = createMockRes();
      await dashboardController.updateComplianceState(req, res);
      assert.strictEqual(res.statusCode, 200, `Role ${role} should be allowed to update compliance state`);
    }

    // 3. Verify Compliance Template controller methods are restricted to ADMIN roles only
    // A. listComplianceTemplates
    for (const role of nonAdminRoles) {
      const req = { user: { firmId: 'F1', role }, query: {} };
      const res = createMockRes();
      await templateController.listComplianceTemplates(req, res);
      assert.strictEqual(res.statusCode, 403, `Role ${role} should be blocked from listing templates`);
    }
    for (const role of adminRoles) {
      const req = { user: { firmId: 'F1', role }, query: {} };
      const res = createMockRes();
      await templateController.listComplianceTemplates(req, res);
      assert.strictEqual(res.statusCode, 200, `Role ${role} should be allowed to list templates`);
    }

    // B. seedSampleComplianceTemplates
    for (const role of nonAdminRoles) {
      const req = { user: { firmId: 'F1', role } };
      const res = createMockRes();
      await templateController.seedSampleComplianceTemplates(req, res);
      assert.strictEqual(res.statusCode, 403, `Role ${role} should be blocked from seeding templates`);
    }
    for (const role of adminRoles) {
      const req = { user: { firmId: 'F1', role } };
      const res = createMockRes();
      await templateController.seedSampleComplianceTemplates(req, res);
      assert.strictEqual(res.statusCode, 200, `Role ${role} should be allowed to seed templates`);
    }

    // C. runComplianceGeneration
    for (const role of nonAdminRoles) {
      const req = { user: { firmId: 'F1', role }, body: {} };
      const res = createMockRes();
      await templateController.runComplianceGeneration(req, res);
      assert.strictEqual(res.statusCode, 403, `Role ${role} should be blocked from running generation`);
    }
    for (const role of adminRoles) {
      const req = { user: { firmId: 'F1', role }, body: {} };
      const res = createMockRes();
      await templateController.runComplianceGeneration(req, res);
      assert.strictEqual(res.statusCode, 200, `Role ${role} should be allowed to run generation`);
    }

    console.log('complianceAccessControl.test.js passed successfully!');
  } finally {
    dashboardService.getComplianceControlRoom = original.getComplianceControlRoom;
    dashboardService.updateComplianceState = original.updateComplianceState;
    complianceTemplateGenerationService.loadTemplates = original.loadTemplates;
    complianceTemplateGenerationService.previewOrGenerate = original.previewOrGenerate;
    complianceTemplateGenerationService.seedSampleTemplates = original.seedSampleTemplates;
    ComplianceObligationTemplate.create = original.createTemplate;
    ComplianceObligationTemplate.findOneAndUpdate = original.findOneAndUpdate;
  }
};

run().catch((error) => {
  console.error('complianceAccessControl.test.js failed', error);
  process.exit(1);
});
