#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

function resMock() {
  return { code: 200, payload: null, status(c){ this.code=c; return this; }, json(p){ this.payload=p; return this; } };
}

async function run() {
  const lookedUpFirmIds = [];
  const categoryFilters = [];

  Module._load = function(request) {
    if (request === '../models/Firm.model') {
      return {
        findById: (id) => {
          lookedUpFirmIds.push(id);
          return {
            select: () => ({ lean: async () => ({ _id: id, settings: {}, storage: { mode: 'docketra_managed' }, intakeConfig: { cms: {} }, firmId: 'F001' }) }),
            save: async () => {},
            settings: {}, intakeConfig: { cms: {} }, storage: { mode: 'docketra_managed', provider: null }, firmId: 'F001',
          };
        },
      };
    }
    if (request === '../models/Category.model') {
      return { findOne: (filter) => { categoryFilters.push(filter); return { select: () => ({ lean: async () => ({ _id: filter._id, subcategories: [{ id: filter['subcategories.id'] }] }) }) }; } };
    }
    if (request === '../models/Team.model') {
      return { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'team1' }) }) }) };
    }
    if (request === '../models/User.model') {
      return { findOne: () => ({ select: async () => ({ _id: 'user1' }) }) };
    }
    if (request.startsWith('../models/')) return {};
    if (request === '../utils/tenantGuard') return { assertFirmContext: () => {} };
    if (request === '../utils/hierarchy.utils') return { assertPrimaryAdmin: () => {}, getTagValidationError:()=>null, normalizeId:(v)=>v };
    if (request === '../services/settingsAudit.service') return { logConfigChange: async () => {}, logWorkflowChange: async () => {}, logIntegrationChange: async () => {} };
    if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {}, listSettingsAudit: async () => ({ items: [], page:1, limit:50, total:0 }) };
    if (request === '../services/adminController.service') return { safeAuditLog: async()=>{}, resetUserToInvitedState:()=>{}, normalizeFirmSettings:(x)=>x, normalizeWorkSettings:(x)=>x };
    if (request === '../services/featureFlags.service') return { isExternalStorageEnabled: () => true };
    if (request === '../utils/log') return { error:()=>{}, warn:()=>{}, info:()=>{} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/admin.controller');
  const admin = require('../src/controllers/admin.controller');

  // ownership firm id used for Firm lookup
  {
    const req = { user: { role: 'PRIMARY_ADMIN', firmId: 'tenant-runtime' }, ownershipFirmId: 'firm-owner-1' };
    const res = resMock();
    await admin.getFirmSettings(req, res, () => {});
    assert.strictEqual(res.code, 200);
    assert.ok(lookedUpFirmIds.includes('firm-owner-1'));
  }

  // updateCmsIntakeSettings: ownership for Firm, tenant for Category/Team/User
  {
    lookedUpFirmIds.length = 0;
    categoryFilters.length = 0;
    const req = {
      user: { role: 'PRIMARY_ADMIN', firmId: 'tenant-runtime-9' },
      ownershipFirmId: 'firm-owner-9',
      body: {
        defaultCategoryId: '507f1f77bcf86cd799439011',
        defaultSubcategoryId: 'sub-1',
        defaultWorkbasketId: '507f1f77bcf86cd799439012',
        defaultAssignee: 'x000001',
      },
    };
    const res = resMock();
    let nextError = null;
    await admin.updateCmsIntakeSettings(req, res, (err) => { nextError = err || null; });
    assert.strictEqual(nextError, null);
    assert.ok(lookedUpFirmIds.includes('firm-owner-9'));
    assert.strictEqual(categoryFilters[0].firmId, 'tenant-runtime-9');
  }

  // missing ownership id: controlled 403
  {
    const req = { user: { role: 'PRIMARY_ADMIN', firmId: 'tenant-runtime' }, body: {} };
    const res = resMock();
    let nextError = null;
    await admin.updateCmsIntakeSettings(req, res, (err) => { nextError = err || null; });
    assert.strictEqual(nextError, null);
    assert.strictEqual(res.code, 403);
    assert.match(res.payload.message, /Ownership firm context is required/);
  }

  // missing runtime tenant id path should not throw ReferenceError
  {
    const req = { user: { role: 'PRIMARY_ADMIN', firmId: null }, firmId: null, ownershipFirmId: 'firm-owner-1', body: { defaultCategoryId: '507f1f77bcf86cd799439011', defaultSubcategoryId: 'sub-1' } };
    const res = resMock();
    let nextError = null;
    await admin.updateCmsIntakeSettings(req, res, (err) => { nextError = err || null; });
    if (nextError) {
      assert.ok(!String(nextError.message || '').includes('firmId is not defined'));
    }
  }


  console.log('adminTenantBoundary.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
