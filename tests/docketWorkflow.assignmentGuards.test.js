const assert = require('assert');

const CaseMock = { findOne: () => ({ select: () => ({ lean: async () => ({ caseId:'C1', ownerTeamId:'wb-1', state:'IN_WB', status:'UNASSIGNED', assignedToXID:'X000111' }) }) }) };
require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/services/workbasketAuthorization.service')] = { exports: {
  getFirmUserByXid: async ()=>({ xID:'X000222', isActive:true, teamIds:['wb-1'] }),
  canAssignFromWorkbasket: () => false,
  canMoveBetweenWorklists: () => true,
} };
require.cache[require.resolve('../src/services/docketWorkflow.service')] = { exports: {
  DocketStatus:{}, pullFromWorkbench: async()=>({ caseId:'C1' }), transition:async()=>{}, qcDecision:async()=>{}, reassign: async()=>({ caseId:'C1' }), reopenDuePending:async()=>({count:0})
} };
const c = require('../src/controllers/docketWorkflow.controller');

const req = { params:{ caseId:'C1' }, body:{ assigneeXID:'X000222' }, user:{ firmId:'f1', xID:'X000001', _id:'u1', role:'MANAGER' } };
const res = { statusCode:200, status(v){this.statusCode=v; return this;}, json(d){this.data=d; return this;} };

(async()=>{
  await c.assignDocket(req,res);
  assert.strictEqual(res.statusCode, 200, 'assigned docket should route through move authorization path');
  console.log('docketWorkflow assignment guard test passed');
})();
