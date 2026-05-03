const assert = require('assert');
const svcFactory = require('../src/services/caseBulk.service');

const deps = {
  Case: { find: () => ({ select:()=>({ lean: async()=>[{ caseId:'C1', state:'IN_WB', status:'UNASSIGNED', ownerTeamId:'wb-1', assignedToXID:'X000999' }] }) }) },
  User: { findOne: () => ({ select: () => ({ lean: async () => ({ _id:'u2', xID:'X000222', isActive:true, teamIds:['wb-1'] }) }) }) },
  getSession: () => null,
};
const service = svcFactory(deps);

const req = { body:{ caseIds:['C1'], assignTo:'u2' }, user:{ xID:'X000001', firmId:'f1', role:'MANAGER', teamIds:['wb-1'] } };
const res = { statusCode:200, status(v){this.statusCode=v; return this;}, json(d){this.data=d; return this;} };
(async()=>{
  await service.pullCases(req,res);
  assert.strictEqual(res.statusCode, 409);
  assert.ok(String(res.data.message).includes('already assigned'));
  console.log('caseBulk assigned guard test passed');
})();
