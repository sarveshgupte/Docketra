#!/usr/bin/env node
'use strict';

const assert = require('assert');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

// Avoid native bcrypt binary dependency when loading auth/admin route graph on Windows Node 24
const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: {
    compare: async (candidate, stored) => candidate === stored,
    hash: async (value) => `hashed:${value}`,
    genSalt: async () => 'mock-salt',
  },
};

process.env.NODE_ENV = 'test';
process.env.ALLOW_REDIS_FALLBACK = 'true';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(64);
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'y'.repeat(64);
process.env.METRICS_TOKEN = process.env.METRICS_TOKEN || 'z'.repeat(64);
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';

const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const {
  WORKBASKET_NAME_MAX_LENGTH,
  normalizeWorkbasketName,
  validateWorkbasketName,
  createPrimaryWithQc,
} = require('../src/services/workbasketGuardrails.service');
const { ensureDefaultWorkbasketForFirm } = require('../src/services/defaultWorkbasket.service');
const { createDefaultWorkbaskets } = require('../src/services/firmSetup.service');
const workbasketController = require('../src/controllers/workbasket.controller');
const teamController = require('../src/controllers/team.controller');

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

function createInMemoryStores() {
  const teams = [];
  const users = [];

  const matchesFirm = (docFirmId, firmFilter) => {
    if (!firmFilter) return true;
    if (firmFilter.$in) {
      return firmFilter.$in.some((f) => String(f) === String(docFirmId));
    }
    return String(docFirmId) === String(firmFilter);
  };

  const matchesClause = (doc, clause) => {
    if (!clause) return true;
    if (clause._id?.$ne && String(doc._id) === String(clause._id.$ne)) return false;
    if (clause._id && !clause._id.$ne && String(doc._id) !== String(clause._id)) return false;
    if (clause.firmId && !matchesFirm(doc.firmId, clause.firmId)) return false;
    if (clause.type && doc.type !== clause.type) return false;
    if (clause.parentWorkbasketId !== undefined && String(doc.parentWorkbasketId || '') !== String(clause.parentWorkbasketId || '')) return false;
    if (clause.status?.$ne && doc.status === clause.status.$ne) return false;
    if (clause.name instanceof RegExp && !clause.name.test(doc.name)) return false;
    if (typeof clause.name === 'string' && doc.name !== clause.name) return false;
    if (Array.isArray(clause.$or)) {
      return clause.$or.some((sub) => matchesClause(doc, sub));
    }
    return true;
  };

  const origTeamFindOne = Team.findOne;
  const origTeamCreate = Team.create;
  const origTeamFindOneAndUpdate = Team.findOneAndUpdate;
  const origTeamDeleteOne = Team.deleteOne;
  const origTeamDeleteMany = Team.deleteMany;
  const origUserFindOne = User.findOne;
  const origUserUpdateOne = User.updateOne;
  const origStartSession = mongoose.startSession;

  const installMocks = ({ txSupported = true, failQcCreateWith = null, failUserUpdateWith = null } = {}) => {
    Team.findOne = (query) => {
      const match = teams.find((t) => matchesClause(t, query)) || null;
      const result = match ? { ...match, save: async function save() { Object.assign(match, this); return match; } } : null;
      return Object.assign(Promise.resolve(result), {
        session: () => Promise.resolve(result),
      });
    };

    Team.create = async (docs) => {
      const doc = docs[0];
      if (doc.type === 'QC' && failQcCreateWith) {
        throw failQcCreateWith;
      }
      // Enforce schema guardrail validation (parentWorkbasketId / type)
      const instance = new Team(doc);
      await instance.validate();

      // Simulate Mongo unique index (firmId + exact name) and partial unique index (firmId + parentWorkbasketId + QC)
      const dupName = teams.find((t) => String(t.firmId) === String(doc.firmId) && t.name === instance.name);
      if (dupName) {
        const err = new Error('E11000 duplicate key error collection: teams index: firmId_1_name_1');
        err.code = 11000;
        throw err;
      }
      if (instance.type === 'QC') {
        const dupQc = teams.find(
          (t) => String(t.firmId) === String(doc.firmId)
            && t.type === 'QC'
            && String(t.parentWorkbasketId) === String(instance.parentWorkbasketId),
        );
        if (dupQc) {
          const err = new Error('E11000 duplicate key error collection: teams index: firmId_1_parentWorkbasketId_1_type_1');
          err.code = 11000;
          throw err;
        }
      }

      const saved = {
        _id: instance._id,
        firmId: instance.firmId,
        name: instance.name,
        managerId: instance.managerId || null,
        type: instance.type,
        parentWorkbasketId: instance.parentWorkbasketId || null,
        isActive: instance.isActive,
      };
      teams.push(saved);
      return [saved];
    };

    Team.findOneAndUpdate = async (filter, update) => {
      let existing = teams.find((t) => matchesClause(t, filter));
      if (!existing) {
        const filterDefaults = Object.fromEntries(
          Object.entries(filter || {}).filter(([, val]) => !(val && typeof val === 'object' && !(val instanceof mongoose.Types.ObjectId))),
        );
        const toInsert = {
          _id: new mongoose.Types.ObjectId(),
          ...filterDefaults,
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
        };
        const instance = new Team(toInsert);
        await instance.validate();
        existing = {
          _id: instance._id,
          firmId: instance.firmId,
          name: instance.name,
          managerId: instance.managerId || null,
          type: instance.type,
          parentWorkbasketId: instance.parentWorkbasketId || null,
          isActive: instance.isActive,
        };
        teams.push(existing);
      } else if (update.$set) {
        Object.assign(existing, update.$set);
      }
      return existing;
    };

    Team.deleteOne = async (filter) => {
      const idx = teams.findIndex((t) => matchesClause(t, filter));
      if (idx !== -1) {
        teams.splice(idx, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    };

    Team.deleteMany = async (filter) => {
      let deletedCount = 0;
      const targetIds = new Set((filter?._id?.$in || []).map(String));
      for (let i = teams.length - 1; i >= 0; i -= 1) {
        if (targetIds.has(String(teams[i]._id))) {
          teams.splice(i, 1);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    };

    User.findOne = async (query) => {
      return users.find((u) => {
        if (query._id && String(u._id) !== String(query._id)) return false;
        if (query.firmId && !matchesFirm(u.firmId, query.firmId)) return false;
        if (query.status?.$ne && u.status === query.status.$ne) return false;
        return true;
      }) || null;
    };

    User.updateOne = async (filter, update) => {
      if (failUserUpdateWith) throw failUserUpdateWith;
      const target = users.find((u) => {
        if (filter._id && String(u._id) !== String(filter._id)) return false;
        if (filter.firmId && !matchesFirm(u.firmId, filter.firmId)) return false;
        if (filter.status?.$ne && u.status === filter.status.$ne) return false;
        return true;
      });
      if (!target) return { matchedCount: 0, modifiedCount: 0 };
      const addedId = update?.$addToSet?.teamIds;
      if (addedId) {
        target.teamIds = target.teamIds || [];
        if (!target.teamIds.some((id) => String(id) === String(addedId))) {
          target.teamIds.push(addedId);
        }
      }
      return { matchedCount: 1, modifiedCount: 1 };
    };

    mongoose.startSession = async () => {
      if (txSupported) {
        return {
          withTransaction: async (fn) => {
            const snapshot = teams.map((t) => ({ ...t }));
            try {
              await fn();
            } catch (err) {
              // Roll back simulated transaction writes cleanly
              teams.splice(0, teams.length, ...snapshot);
              throw err;
            }
          },
          endSession: async () => {},
        };
      }
      return {
        withTransaction: async () => {
          throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
        },
        endSession: async () => {},
      };
    };
  };

  const restore = () => {
    Team.findOne = origTeamFindOne;
    Team.create = origTeamCreate;
    Team.findOneAndUpdate = origTeamFindOneAndUpdate;
    Team.deleteOne = origTeamDeleteOne;
    Team.deleteMany = origTeamDeleteMany;
    User.findOne = origUserFindOne;
    User.updateOne = origUserUpdateOne;
    mongoose.startSession = origStartSession;
  };

  return { teams, users, installMocks, restore };
}

async function testNameValidationAndGuardrails() {
  assert.strictEqual(normalizeWorkbasketName('   Tax    &   Compliance  '), 'Tax & Compliance');
  assert.throws(() => validateWorkbasketName(''), (e) => e.statusCode === 400);
  assert.throws(() => validateWorkbasketName('   \t  '), (e) => e.statusCode === 400);
  assert.throws(() => validateWorkbasketName('Bad\x00Name'), (e) => e.statusCode === 400);
  assert.throws(() => validateWorkbasketName('A'.repeat(WORKBASKET_NAME_MAX_LENGTH + 1)), (e) => e.statusCode === 400);

  for (const reserved of ['Tax - QC', 'Tax — QC', 'Tax – QC', 'Audit-qc', 'Statutory  -   QC']) {
    assert.throws(
      () => validateWorkbasketName(reserved),
      (e) => e.statusCode === 400 && e.message.includes('- QC'),
      `Reserved QC suffix must be blocked for "${reserved}"`,
    );
  }

  assert.strictEqual(validateWorkbasketName('GST & Compliance'), 'GST & Compliance');
  console.log('  ✓ Workbasket name normalization, length, control-char, and reserved QC suffix guards passed');
}

async function testGuardrailsServiceAndAtomicity() {
  const store = createInMemoryStores();
  const firmA = new mongoose.Types.ObjectId();
  const firmB = new mongoose.Types.ObjectId();
  const activeManager = { _id: new mongoose.Types.ObjectId(), firmId: firmA, status: 'active', isActive: true, teamIds: [] };
  const inactiveManager = { _id: new mongoose.Types.ObjectId(), firmId: firmA, status: 'active', isActive: false, teamIds: [] };
  const crossTenantManager = { _id: new mongoose.Types.ObjectId(), firmId: firmB, status: 'active', isActive: true, teamIds: [] };
  store.users.push(activeManager, inactiveManager, crossTenantManager);

  try {
    store.installMocks({ txSupported: true });

    // Cross-tenant, inactive, non-existent, and malformed managerId must fail 400 before creating teams
    for (const badManagerId of ['not-an-id', new mongoose.Types.ObjectId(), inactiveManager._id, crossTenantManager._id]) {
      await assert.rejects(
        () => createPrimaryWithQc({ firmId: firmA, name: 'Valid Team', managerId: badManagerId }),
        (err) => err.statusCode === 400,
      );
      assert.strictEqual(store.teams.length, 0, 'Failed manager check must leave 0 created teams');
    }

    // Create Primary + QC with valid manager in firmA
    const created = await createPrimaryWithQc({
      firmId: firmA,
      name: '  Direct   Tax  ',
      managerId: activeManager._id,
    });
    assert.strictEqual(created.primary.name, 'Direct Tax');
    assert.strictEqual(created.primary.type, 'PRIMARY');
    assert.strictEqual(created.primary.parentWorkbasketId, null);
    assert.strictEqual(created.qc.name, 'Direct Tax — QC');
    assert.strictEqual(created.qc.type, 'QC');
    assert.strictEqual(String(created.qc.parentWorkbasketId), String(created.primary._id));
    assert.strictEqual(activeManager.teamIds.map(String).includes(String(created.qc._id)), true);

    // Case-insensitive + extra-whitespace + inactive duplicate detection must reject 409
    await assert.rejects(
      () => createPrimaryWithQc({ firmId: firmA, name: 'direct tax' }),
      (err) => err.statusCode === 409,
    );
    created.primary.isActive = false;
    await assert.rejects(
      () => createPrimaryWithQc({ firmId: firmA, name: 'DIRECT   TAX' }),
      (err) => err.statusCode === 409,
    );

    // Same name in firmB must be allowed (multi-tenant isolation)
    const firmBCreated = await createPrimaryWithQc({ firmId: firmB, name: 'Direct Tax' });
    assert.strictEqual(firmBCreated.primary.name, 'Direct Tax');
    assert.strictEqual(firmBCreated.qc.name, 'Direct Tax — QC');

    // Non-transactional fallback still creates Primary + QC cleanly
    store.installMocks({ txSupported: false });
    const standalone = await createPrimaryWithQc({ firmId: firmA, name: 'ROC Filings' });
    assert.strictEqual(standalone.primary.name, 'ROC Filings');
    assert.strictEqual(standalone.qc.name, 'ROC Filings — QC');

    // Non-transactional compensation deletes orphan Primary when QC fails
    const countBeforeFail = store.teams.length;
    store.installMocks({ txSupported: false, failQcCreateWith: Object.assign(new Error('E11000 dup qc'), { code: 11000 }) });
    await assert.rejects(
      () => createPrimaryWithQc({ firmId: firmA, name: 'Secretarial Audit' }),
      (err) => err.statusCode === 409,
    );
    assert.strictEqual(store.teams.length, countBeforeFail, 'Orphan Primary must be rolled back on QC failure');

    // Non-transactional compensation deletes both Primary and QC if User.updateOne fails
    store.installMocks({ txSupported: false, failUserUpdateWith: new Error('Manager link DB error') });
    await assert.rejects(
      () => createPrimaryWithQc({ firmId: firmA, name: 'Legal Advisory', managerId: activeManager._id }),
      /Manager link DB error/,
    );
    assert.strictEqual(store.teams.length, countBeforeFail, 'Both Primary and QC must be rolled back if manager link fails');
  } finally {
    store.restore();
  }

  console.log('  ✓ Service guardrails, multi-tenant isolation, manager scoping, and rollback compensation passed');
}

async function testControllersAndDefaultSeeding() {
  const store = createInMemoryStores();
  const firmId = new mongoose.Types.ObjectId();

  try {
    store.installMocks({ txSupported: true });

    // createWorkbasket validation returns 400 (never 500)
    const badNameRes = createRes();
    await workbasketController.createWorkbasket({ user: { role: 'ADMIN', firmId }, body: { name: 'Tax - QC' } }, badNameRes);
    assert.strictEqual(badNameRes.statusCode, 400);

    // createWorkbasket success returns 201 with primary + qcWorkbasket
    const okWbRes = createRes();
    await workbasketController.createWorkbasket({ user: { role: 'ADMIN', firmId }, body: { name: 'FEMA Advisory' } }, okWbRes);
    assert.strictEqual(okWbRes.statusCode, 201);
    assert.strictEqual(okWbRes.body.data.name, 'FEMA Advisory');
    assert.strictEqual(okWbRes.body.qcWorkbasket.name, 'FEMA Advisory — QC');

    // renameWorkbasket rejects reserved QC suffix with 400
    const badRenameRes = createRes();
    await workbasketController.renameWorkbasket({
      params: { workbasketId: String(okWbRes.body.data._id) },
      body: { name: 'FEMA - QC' },
      user: { firmId },
    }, badRenameRes);
    assert.strictEqual(badRenameRes.statusCode, 400);

    // createTeam rejects non-PRIMARY_ADMIN with 403, duplicates with 409, and bad managerId with 400
    const nonPaTeamRes = createRes();
    await teamController.createTeam({ user: { role: 'ADMIN', firmId }, body: { name: 'Another Team' } }, nonPaTeamRes);
    assert.strictEqual(nonPaTeamRes.statusCode, 403);

    const dupTeamRes = createRes();
    await teamController.createTeam({ user: { role: 'PRIMARY_ADMIN', firmId }, body: { name: 'fema advisory' } }, dupTeamRes);
    assert.strictEqual(dupTeamRes.statusCode, 409);

    const badTeamMgrRes = createRes();
    await teamController.createTeam({ user: { role: 'PRIMARY_ADMIN', firmId }, body: { name: 'Valid New', managerId: 'invalid' } }, badTeamMgrRes);
    assert.strictEqual(badTeamMgrRes.statusCode, 400);

    const okTeamRes = createRes();
    await teamController.createTeam({ user: { role: 'PRIMARY_ADMIN', firmId }, body: { name: 'Insolvency Practice' } }, okTeamRes);
    assert.strictEqual(okTeamRes.statusCode, 201);
    assert.strictEqual(okTeamRes.body.data.name, 'Insolvency Practice');
    assert.strictEqual(okTeamRes.body.qcWorkbasket.name, 'Insolvency Practice — QC');

    // ensureDefaultWorkbasketForFirm and createDefaultWorkbaskets both create linked QC queues
    const newFirmId = new mongoose.Types.ObjectId();
    const defaultWb = await ensureDefaultWorkbasketForFirm(newFirmId);
    assert.strictEqual(defaultWb.name, 'Default Workbasket');
    assert.ok(
      store.teams.some((t) => String(t.firmId) === String(newFirmId) && t.type === 'QC' && String(t.parentWorkbasketId) === String(defaultWb._id)),
      'ensureDefaultWorkbasketForFirm must create linked QC queue',
    );

    const setupFirmId = new mongoose.Types.ObjectId();
    const wbMap = await createDefaultWorkbaskets(setupFirmId, new mongoose.Types.ObjectId());
    assert.ok(wbMap.size >= 7);
    const setupPrimaries = store.teams.filter((t) => String(t.firmId) === String(setupFirmId) && t.type === 'PRIMARY');
    const setupQcs = store.teams.filter((t) => String(t.firmId) === String(setupFirmId) && t.type === 'QC');
    assert.strictEqual(setupQcs.length, setupPrimaries.length, 'Every default template PRIMARY workbasket must have a linked QC workbasket');
  } finally {
    store.restore();
  }

  console.log('  ✓ Controllers (workbasket + team + rename) and default setup QC creation passed');
}

async function testHttpRoutesAndSchemasEndToEnd() {
  const store = createInMemoryStores();
  const firmId = new mongoose.Types.ObjectId();
  const validManager = { _id: new mongoose.Types.ObjectId(), firmId, status: 'active', isActive: true, teamIds: [] };
  store.users.push(validManager);
  store.installMocks({ txSupported: true });

  const swapCache = [];
  const swap = (modulePath, exportsValue) => {
    const resolved = require.resolve(modulePath);
    swapCache.push({ resolved, original: require.cache[resolved] });
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsValue };
  };

  try {
    const authGate = (req, res, next) => {
      if (req.headers['x-unauth'] === '1') return res.status(401).json({ success: false, message: 'Authentication required' });
      const role = String(req.headers['x-role'] || 'PRIMARY_ADMIN').toUpperCase();
      req.user = { _id: new mongoose.Types.ObjectId(), xID: 'X000001', role, firmId };
      if (req.headers['x-no-firm'] === '1') {
        req.user.firmId = null;
        return res.status(403).json({ success: false, message: 'Firm context is required' });
      }
      req.firmId = firmId;
      return next();
    };

    const routeGroupsOrig = require('../src/routes/routeGroups');
    swap('../src/routes/routeGroups', { ...routeGroupsOrig, adminBaseAccess: [authGate] });

    const permOrig = require('../src/middleware/permission.middleware');
    swap('../src/middleware/permission.middleware', {
      ...permOrig,
      authorizeFirmPermission: (perm) => (req, res, next) => {
        if (req.headers['x-deny-perm'] === perm) {
          return res.status(403).json({ success: false, message: `Missing permission: ${perm}` });
        }
        return next();
      },
    });

    // Stub non-workbasket admin route dependencies so admin.routes loads cleanly
    const noop = (_req, res) => res.json({ success: true });
    const proxyController = new Proxy({}, { get: () => noop });
    swap('../src/controllers/auth.controller', proxyController);
    swap('../src/controllers/admin.controller', proxyController);
    swap('../src/controllers/firm.controller', proxyController);
    swap('../src/controllers/category.controller', proxyController);
    swap('../src/controllers/client.controller', proxyController);
    swap('../src/controllers/capacity.controller', proxyController);

    delete require.cache[require.resolve('../src/routes/admin.routes')];
    delete require.cache[require.resolve('../src/routes/team.routes')];
    const adminRoutes = require('../src/routes/admin.routes');
    const teamRoutes = require('../src/routes/team.routes');

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use('/api/teams', authGate, teamRoutes);

    // Unauthenticated -> 401; USER -> 403; missing permission -> 403
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').set('x-unauth', '1').send({ name: 'WB' })).status, 401);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').set('x-no-firm', '1').send({ name: 'WB' })).status, 403);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').set('x-role', 'USER').send({ name: 'WB' })).status, 403);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').set('x-role', 'ADMIN').set('x-deny-perm', 'WORKBASKET_MANAGE').send({ name: 'WB' })).status, 403);

    // PRIMARY_ADMIN, ADMIN, and MANAGER can create workbaskets
    for (const [idx, role] of ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER'].entries()) {
      const ok = await request(app).post('/api/admin/workbaskets').set('x-role', role).send({
        name: `Role Desk ${idx}`,
        ...(idx === 0 ? { managerId: String(validManager._id) } : {}),
      });
      assert.strictEqual(ok.status, 201, `${role} should be able to create a workbasket`);
      assert.strictEqual(ok.body.data.type, 'PRIMARY');
      assert.strictEqual(ok.body.qcWorkbasket.type, 'QC');
    }

    // Strict schema rejects empty, >80 chars, bad managerId, extra unknown keys
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: '   ' })).status, 400);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: 'X'.repeat(81) })).status, 400);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: 'WB', managerId: 'bad-id' })).status, 400);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: 'WB', extraField: 1 })).status, 400);

    // Reserved suffix + duplicate blocked at API boundary
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: 'Tax - QC' })).status, 400);
    assert.strictEqual((await request(app).post('/api/admin/workbaskets').send({ name: '  role   desk   0 ' })).status, 409);

    // /api/teams route enforces requirePrimaryAdmin (ADMIN -> 403, PRIMARY_ADMIN -> 201, dup -> 409)
    assert.strictEqual((await request(app).post('/api/teams').set('x-role', 'ADMIN').send({ name: 'Team Via Admin' })).status, 403);
    assert.strictEqual((await request(app).post('/api/teams').set('x-role', 'PRIMARY_ADMIN').send({ name: 'Team Via Primary' })).status, 201);
    assert.strictEqual((await request(app).post('/api/teams').set('x-role', 'PRIMARY_ADMIN').send({ name: 'team via primary' })).status, 409);
  } finally {
    for (const item of swapCache) {
      if (item.original) require.cache[item.resolved] = item.original;
      else delete require.cache[item.resolved];
    }
    delete require.cache[require.resolve('../src/routes/admin.routes')];
    delete require.cache[require.resolve('../src/routes/team.routes')];
    store.restore();
  }

  console.log('  ✓ End-to-end HTTP route, schema, RBAC, and permission contracts passed');
}

async function run() {
  console.log('Running airtight workbasket creation tests...');
  await testNameValidationAndGuardrails();
  await testGuardrailsServiceAndAtomicity();
  await testControllersAndDefaultSeeding();
  await testHttpRoutesAndSchemasEndToEnd();
  console.log('✅ All airtight workbasket creation tests passed!');
}

run().catch((error) => {
  console.error('❌ workbasketCreationAirtight tests failed:', error);
  process.exit(1);
});
