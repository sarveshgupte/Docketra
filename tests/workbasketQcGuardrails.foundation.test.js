const assert = require('assert');
const mongoose = require('mongoose');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const { createPrimaryWithQc } = require('../src/services/workbasketGuardrails.service');
const workbasketController = require('../src/controllers/workbasket.controller');
const teamController = require('../src/controllers/team.controller');

function res(){return{statusCode:200,body:null,status(c){this.statusCode=c;return this;},json(p){this.body=p;return this;}}}

async function testModelOrphanAndParentType() {
  const t = new Team({ name: 'q', firmId: new mongoose.Types.ObjectId(), type: 'QC' });
  await assert.rejects(() => t.validate());
}

async function testCreateInvalidManagerId() {
  const r = res();
  await teamController.createTeam({ user: { role:'PRIMARY_ADMIN', firmId: new mongoose.Types.ObjectId() }, body: { name:'A', managerId:'bad' } }, r);
  assert.strictEqual(r.statusCode, 400);
}

async function testCreateConsistency() {
  const origFindOne = Team.findOne;
  const origCreate = Team.create;
  const origUpdateOne = User.updateOne;
  const origStart = mongoose.startSession;

  Team.findOne = async () => null;
  let createdRows = [];
  Team.create = async (docs) => { createdRows.push(docs[0]); return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }]; };
  User.updateOne = async () => ({});
  mongoose.startSession = async () => ({ withTransaction: async (fn)=>fn(), endSession: async ()=>{} });

  const teamRes = res();
  await teamController.createTeam({ user: { role:'PRIMARY_ADMIN', firmId: new mongoose.Types.ObjectId() }, body: { name:'WB1' } }, teamRes);
  const wbRes = res();
  await workbasketController.createWorkbasket({ user: { role:'MANAGER', firmId: new mongoose.Types.ObjectId() }, body: { name:'WB2' } }, wbRes);
  assert.strictEqual(teamRes.statusCode, 201);
  assert.strictEqual(wbRes.statusCode, 201);
  assert.strictEqual(createdRows.filter((d)=>d.type==='PRIMARY').length >= 2, true);

  Team.findOne = origFindOne; Team.create = origCreate; User.updateOne = origUpdateOne; mongoose.startSession = origStart;
}

async function testRouteLevelLikeControllerQcPermissions() {
  const origTeamFindOne = Team.findOne;
  const origUserFindOne = User.findOne;
  const origUserUpdateOne = User.updateOne;

  Team.findOne = (q) => ({ lean: async ()=> (q.type==='QC' ? { _id:q._id, firmId:q.firmId, parentWorkbasketId: new mongoose.Types.ObjectId() } : { managerId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011') }) });
  User.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
  let updated = false; User.updateOne = async ()=>{updated=true;};

  const ok = res();
  await workbasketController.addQcMember({ params:{workbasketId:'507f1f77bcf86cd799439012'}, body:{userId:'507f1f77bcf86cd799439013'}, user:{ _id:'507f1f77bcf86cd799439011', role:'MANAGER', firmId:'507f1f77bcf86cd799439014'} }, ok);
  assert.strictEqual(ok.statusCode,200); assert.strictEqual(updated,true);

  const denied = res();
  await workbasketController.addQcMember({ params:{workbasketId:'507f1f77bcf86cd799439012'}, body:{userId:'507f1f77bcf86cd799439013'}, user:{ _id:'507f1f77bcf86cd799439099', role:'MANAGER', firmId:'507f1f77bcf86cd799439014'} }, denied);
  assert.strictEqual(denied.statusCode,403);

  const deniedUser = res();
  await workbasketController.addQcMember({ params:{workbasketId:'507f1f77bcf86cd799439012'}, body:{userId:'507f1f77bcf86cd799439013'}, user:{ _id:'507f1f77bcf86cd799439099', role:'USER', firmId:'507f1f77bcf86cd799439014'} }, deniedUser);
  assert.strictEqual(deniedUser.statusCode,403);

  Team.findOne = origTeamFindOne; User.findOne = origUserFindOne; User.updateOne = origUserUpdateOne;
}

async function run(){
  try { await testModelOrphanAndParentType(); await testCreateInvalidManagerId(); await testCreateConsistency(); await testRouteLevelLikeControllerQcPermissions(); console.log('workbasket QC foundation tests passed.'); }
  catch(e){ console.error(e); process.exit(1);} }
run();
