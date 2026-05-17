const assert = require('assert');
const fs = require('fs');
const mongoose = require('mongoose');
const { requireManagerOrPrimaryAdmin } = require('../src/middleware/rbac.middleware');
const workbasketController = require('../src/controllers/workbasket.controller');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');

function res(){return{statusCode:200,body:null,status(c){this.statusCode=c;return this;},json(p){this.body=p;return this;}}}

async function testRoleNormalizationManagerGate() {
  const allowReq = { user: { role: ' manager ' } };
  let nextCalled = false;
  requireManagerOrPrimaryAdmin(allowReq, res(), () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);

  const deny = res();
  requireManagerOrPrimaryAdmin({ user: { role: 'user' } }, deny, () => {});
  assert.strictEqual(deny.statusCode, 403);
}

async function testRenamePrimaryRenamesDefaultQc() {
  const origFindOne = Team.findOne;
  const origUpdateMany = User.updateMany;
  const origUserFind = User.find;
  const wb = { _id: new mongoose.Types.ObjectId(), name: 'Ops', type: 'PRIMARY', save: async () => {} };
  const qc = { name: 'Ops — QC', save: async () => { qc.saved = true; } };
  Team.findOne = async (query) => {
    if (query.parentWorkbasketId) return qc;
    if (query._id && typeof query._id === 'string') return wb;
    if (query._id && query._id.$ne) return null;
    return null;
  };

  const r = res();
  await workbasketController.renameWorkbasket({ params: { workbasketId: String(wb._id) }, body: { name: 'Ops 2' }, user: { firmId: new mongoose.Types.ObjectId() } }, r);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(qc.name, 'Ops 2 — QC');
  assert.strictEqual(qc.saved, true);
  Team.findOne = origFindOne;
  User.updateMany = origUpdateMany;
  User.find = origUserFind;
}

async function testRenameMissingQcNoPartialSave() {
  const origFindOne = Team.findOne;
  const origUpdateMany = User.updateMany;
  const origUserFind = User.find;
  const wb = { _id: new mongoose.Types.ObjectId(), name: 'Ops', type: 'PRIMARY', save: async () => { wb.saved = true; } };
  Team.findOne = async (query) => {
    if (query.parentWorkbasketId) return null;
    if (query._id && typeof query._id === 'string') return wb;
    if (query._id && query._id.$ne) return null;
    return null;
  };
  const r = res();
  await workbasketController.renameWorkbasket({ params: { workbasketId: String(wb._id) }, body: { name: 'Ops 2' }, user: { firmId: new mongoose.Types.ObjectId() } }, r);
  assert.strictEqual(r.statusCode, 409);
  assert.strictEqual(Boolean(wb.saved), false);
  Team.findOne = origFindOne;
  User.updateMany = origUpdateMany;
  User.find = origUserFind;
}

async function testDeactivateCascadeAndMissingQcNoPartialSave() {
  const origFindOne = Team.findOne;
  const origUpdateMany = User.updateMany;
  const origUserFind = User.find;
  const wb = { _id: new mongoose.Types.ObjectId(), type: 'PRIMARY', isActive: true, save: async () => { wb.saved = true; } };
  const qc = { isActive: true, save: async () => { qc.saved = true; } };
  Team.findOne = async (query) => {
    if (query.parentWorkbasketId) return qc;
    if (query._id && typeof query._id === 'string') return wb;
    return null;
  };
  User.updateMany = async () => ({});
  User.find = () => ({ select: () => ({ lean: async () => [] }) });
  const r1 = res();
  await workbasketController.toggleWorkbasketStatus({ params: { workbasketId: String(wb._id) }, body: { isActive: false }, user: { firmId: new mongoose.Types.ObjectId() } }, r1);
  assert.strictEqual(r1.statusCode, 200);
  assert.strictEqual(wb.saved, true);
  assert.strictEqual(qc.saved, true);

  wb.saved = false;
  Team.findOne = async (query) => {
    if (query.parentWorkbasketId) return null;
    if (query._id && typeof query._id === 'string') return wb;
    return null;
  };
  const r2 = res();
  await workbasketController.toggleWorkbasketStatus({ params: { workbasketId: String(wb._id) }, body: { isActive: false }, user: { firmId: new mongoose.Types.ObjectId() } }, r2);
  assert.strictEqual(r2.statusCode, 409);
  assert.strictEqual(Boolean(wb.saved), false);
  Team.findOne = origFindOne;
  User.updateMany = origUpdateMany;
  User.find = origUserFind;
}

function testSourceGuards() {
  const protectedRoutes = fs.readFileSync('ui/src/routes/ProtectedRoutes.jsx', 'utf8');
  assert.ok(protectedRoutes.includes('<ProtectedRoute requireManagerOrAbove>'));

  const protectedRoute = fs.readFileSync('ui/src/components/auth/ProtectedRoute.jsx', 'utf8');
  assert.ok(protectedRoute.includes('requireManagerOrAbove'));
  assert.ok(protectedRoute.includes('Manager access is required to view that page.'));

  const workSettingsSource = fs.readFileSync('ui/src/pages/WorkSettingsPage.jsx', 'utf8');
  assert.ok(workSettingsSource.includes('primaryWorkbaskets.map((workbasket) => ('));
  assert.ok(workSettingsSource.includes('qcByPrimaryId'));

  const teamMgmtOwner = fs.readFileSync('src/controllers/workbasket.controller.js', 'utf8');
  assert.ok(teamMgmtOwner.includes('updateUserWorkbaskets'));
  assert.ok(teamMgmtOwner.includes('addQcMember'));
}

async function run(){
  await testRoleNormalizationManagerGate();
  await testRenamePrimaryRenamesDefaultQc();
  await testRenameMissingQcNoPartialSave();
  await testDeactivateCascadeAndMissingQcNoPartialSave();
  testSourceGuards();
  console.log('work management hardening slice2 tests passed.');
}

run().catch((e)=>{console.error(e);process.exit(1);});
