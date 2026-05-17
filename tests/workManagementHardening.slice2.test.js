const assert = require('assert');
const mongoose = require('mongoose');
const { requireManagerOrPrimaryAdmin } = require('../src/middleware/rbac.middleware');
const workbasketController = require('../src/controllers/workbasket.controller');
const Team = require('../src/models/Team.model');

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
}

async function run(){
  await testRoleNormalizationManagerGate();
  await testRenamePrimaryRenamesDefaultQc();
  console.log('work management hardening slice2 tests passed.');
}

run().catch((e)=>{console.error(e);process.exit(1);});
