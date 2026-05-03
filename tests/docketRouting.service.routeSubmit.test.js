const assert = require('assert');
const Case = require('../src/models/Case.model');
const Team = require('../src/models/Team.model');
const DocketRoute = require('../src/models/DocketRoute.model');
const svc = require('../src/services/docketRouting.service');

(async () => {
  const original = { caseFindOne: Case.findOne, teamFindOne: Team.findOne, routeCreate: DocketRoute.create, routeFindOne: DocketRoute.findOne };
  try {
    const savedRoutes = [];
    const activeRoute = { returnedAt: null, note: 'orig', save: async function(){ this.saved=true; } };
    DocketRoute.create = async (payload) => { savedRoutes.push(payload); return payload; };
    DocketRoute.findOne = () => ({ sort: async () => activeRoute });

    const docket = { caseId: 'CASE-1', firmId: 'F1', ownerTeamId: 'HR', workbasketId: 'HR', status: 'OPEN', save: async () => docket };
    Case.findOne = async () => docket;
    Team.findOne = ({ firmId, isActive, type, _id }) => ({ select: () => ({ lean: async () => (firmId === 'F1' && isActive && type === 'PRIMARY' && ['LEGAL','FIN'].includes(_id) ? { _id, name: _id, isActive: true, type: 'PRIMARY' } : null) }) });

    await svc.routeDocket({ docketId: 'CASE-1', actor: { xID: 'HRUSER', teamId: 'HR', role: 'PRIMARY_ADMIN' }, firmId: 'F1', toTeamId: 'LEGAL', note: 'to legal' });
    assert.equal(docket.routeOriginatorUserXID, 'HRUSER');
    assert.equal(docket.routeOriginatorTeamId, 'HR');

    docket.assignedToXID = 'LUSER';
    await svc.routeDocket({ docketId: 'CASE-1', actor: { xID: 'LUSER', teamId: 'LEGAL', role: 'USER' }, firmId: 'F1', toTeamId: 'FIN', note: 'to finance' });
    assert.equal(docket.routeOriginatorUserXID, 'LUSER', 'Onward route should set current-route originator');
    assert.equal(savedRoutes[1].fromTeamId, 'LEGAL');

    docket.routedToTeamId = 'FIN';
    docket.assignedToXID = 'FUSER';
    docket.routeOriginatorUserXID = 'LUSER';
    docket.routeOriginatorTeamId = 'LEGAL';
    docket.routeOriginatorWorkbasketId = 'LEGAL';

    await svc.returnRoutedDocket({ docketId: 'CASE-1', actor: { xID: 'FUSER', teamId: 'FIN' }, firmId: 'F1', note: 'done' });
    assert.equal(docket.assignedToXID, 'LUSER');
    assert.equal(docket.routedToTeamId, null);
    assert.equal(docket.ownerTeamId, 'LEGAL');
    assert.ok(activeRoute.returnedAt instanceof Date, 'active route should be marked returned');
    assert.ok(String(activeRoute.note).includes('Return note: done'));
    assert.equal(docket.routeOriginatorUserXID, null, 'active route origin fields should be cleared');

    console.log('docket routing route+submit checks passed');
  } finally {
    Case.findOne = original.caseFindOne; Team.findOne = original.teamFindOne; DocketRoute.create = original.routeCreate; DocketRoute.findOne = original.routeFindOne;
  }
})();
