const assert = require('assert');

const notifications = [];
require.cache[require.resolve('../src/domain/notifications')] = { exports: {
  NotificationTypes: { ASSIGNED:'DOCKET_ASSIGNED', QC_RETURNED:'QC_RETURNED', PENDED_DOCKET_REOPENED:'PENDED_DOCKET_REOPENED', DOCKET_ROUTED_TO_WORKBASKET:'DOCKET_ROUTED_TO_WORKBASKET', LIFECYCLE_CHANGED:'STATUS_CHANGED', REASSIGNED:'DOCKET_REASSIGNED', DOCKET_ACTIVATED:'STATUS_CHANGED' },
  createNotification: async (p) => { notifications.push(p); },
}};
require.cache[require.resolve('../src/services/docketAudit.service')] = { exports: { logDocketEvent: async()=>{}, createLog: async()=>{}, logStatusChange: async()=>{} } };
require.cache[require.resolve('../src/services/docketEvents.service')] = { exports: { EVENT_NAMES:{PENDING_REOPEN:'PENDING_REOPEN',QC_FAILURE:'QC_FAILURE',QC_REQUEST:'QC_REQUEST',ASSIGNMENT:'ASSIGNMENT'}, emitDocketEvent:()=>{} } };
require.cache[require.resolve('../src/models/Comment.model')] = { exports: { create: async (payload) => payload } };
const Case = require('../src/models/Case.model');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const DocketRoute = require('../src/models/DocketRoute.model');

(async () => {
  // routing recipients teamId + teamIds
  const routingSvc = require('../src/services/docketRouting.service');
  Case.findOne = async () => ({ caseId:'D1', firmId:'F1', ownerTeamId:'T0', save: async()=>{}, routedToTeamId:null });
  Team.findOne = () => ({ select: () => ({ lean: async()=>({_id:'T1', name:'WB-1', isActive:true, type:'PRIMARY'}) }) });
  User.find = () => ({ select: () => ({ lean: async()=>([{xID:'X1'},{xID:'X2'}]) }) });
  DocketRoute.create = async () => {};
  notifications.length=0;
  await routingSvc.routeDocket({ docketId:'D1', actor:{xID:'XACT', role:'ADMIN', teamId:'T0'}, firmId:'F1', toTeamId:'T1', note:'route' });
  assert.equal(notifications.filter(n=>n.type==='DOCKET_ROUTED_TO_WORKBASKET').length,2);

  // qc returned
  const wf = require('../src/services/docketWorkflow.service');
  const docket={ status:'QC_PENDING', state:'IN_QC', lifecycle:'WL', assignedToXID:'XSUB', qc:{}, toObject:()=>({status:'QC_PENDING'}), save:async()=>{} };
  Case.findOne = async () => docket;
  notifications.length=0;
  await wf.qcDecision({ docketId:'D2', firmId:'F1', actor:{xID:'XQC', role:'ADMIN'}, decision:'FAILED', comment:'fix' });
  assert.equal(notifications.some(n=>n.type==='QC_RETURNED'), true);

  // pending reopen keeps WB/GLOBAL and no notification without recipient
  const updates=[];
  Case.find = async () => ([{ _id:'1', caseId:'D3', firmId:'F1', assignedToXID:null }]);
  Case.updateOne = async (_f,u)=>{updates.push(u); return {modifiedCount:1};};
  notifications.length=0;
  await wf.reopenDuePending();
  assert.equal(updates[0].$set.state, 'IN_WB');
  assert.equal(updates[0].$set.queueType, 'GLOBAL');
  assert.equal(notifications.some(n=>n.type==='PENDED_DOCKET_REOPENED'), false);

  console.log('docketWorkflowNotifications.test.js passed');
})();
