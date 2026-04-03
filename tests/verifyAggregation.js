const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * Lightweight verification script for getCases aggregation refactor
 * Mocks the entire module system for Case/Client/Repository models
 * because node_modules are missing in the environment.
 */

// 1. Mock Mongoose & Models
const mockMongoose = {
  Schema: function() {
    this.index = () => {};
    this.plugin = () => {};
    this.pre = () => {};
    this.post = () => {};
    this.virtual = () => ({ get: () => {} });
    this.methods = {};
    this.set = () => {};
    this.path = () => ({ validate: () => {} });
  },
  model: function(name) {
    return {
      aggregate: async (pipeline) => {
         mockMongoose.lastPipeline = pipeline;
         return [
           {
             caseId: 'CASE-1',
             clientId: 'C1',
             firmId: 'F1',
             description: 'ENC_DESC',
             client: { clientId: 'C1', businessName: 'Client 1', businessEmail: 'ENC_EMAIL' }
           }
         ];
      },
      countDocuments: async () => 100
    };
  }
};
mockMongoose.Schema.Types = { ObjectId: String, Mixed: Object };
require.cache[require.resolve('mongoose')] = { exports: mockMongoose };

// 2. Mock Repositories
const mockCaseRepo = {
  decryptDocs: async (docs) => {
    docs.forEach(d => { if(d.description === 'ENC_DESC') d.description = 'DEC_DESC'; });
    return docs;
  }
};
const mockClientRepo = {
  decryptDocs: async (docs) => {
    docs.forEach(d => { if(d.businessEmail === 'ENC_EMAIL') d.businessEmail = 'DEC_EMAIL'; });
    return docs;
  }
};
require.cache[require.resolve('../src/repositories/CaseRepository')] = { exports: mockCaseRepo };
require.cache[require.resolve('../src/repositories/ClientRepository')] = { exports: mockClientRepo };
require.cache[require.resolve('../src/repositories')] = { exports: { CaseRepository: mockCaseRepo, ClientRepository: mockClientRepo } };

// 3. Mock Utilities & Config
require.cache[require.resolve('../src/utils/tenantScope')] = { exports: { enforceTenantScope: (q) => q } };
require.cache[require.resolve('../src/config/constants')] = { exports: { CASE_CATEGORIES: {}, CLIENT_STATUS: {}, CASE_ACTION_TYPES: {} } };
require.cache[require.resolve('../src/domain/case/caseStatus')] = { exports: {} };
require.cache[require.resolve('../src/config/config')] = { exports: { isProduction: () => false } };
require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseListViewed: async () => {}, logAdminAction: async () => {} } };
require.cache[require.resolve('../src/middleware/wrapWriteHandler')] = { exports: (fn) => fn };
require.cache[require.resolve('crypto')] = { exports: { randomUUID: () => 'uuid' } };

// 4. Load Controller
const { getCases } = require('../src/controllers/case.controller');

async function testAggregation() {
  console.log('Testing getCases aggregation pipeline...');

  const req = {
    user: { firmId: '507f1f77bcf86cd799439011', role: 'Admin', xID: 'X1' },
    query: { page: 1, limit: 10 }
  };
  const res = {
    json: (data) => {
      // Assertions
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 1);
      assert.strictEqual(data.data[0].description, 'DEC_DESC', 'Case should be decrypted');
      assert.strictEqual(data.data[0].client.businessEmail, 'DEC_EMAIL', 'Client should be decrypted');

      const pipeline = mockMongoose.lastPipeline;
      assert.ok(pipeline.some(s => s.$lookup), 'Pipeline must contain $lookup');
      console.log('✓ Aggregation pipeline correctly joined and results decrypted');
    },
    set: () => {},
    setHeader: () => {}
  };

  await getCases(req, res);
}

testAggregation().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
