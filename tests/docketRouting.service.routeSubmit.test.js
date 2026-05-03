const assert = require('assert');
const Case = require('../src/models/Case.model');
const Team = require('../src/models/Team.model');
const DocketRoute = require('../src/models/DocketRoute.model');
const svc = require('../src/services/docketRouting.service');

(async () => {
  const original = { caseFindOne: Case.findOne, teamFindOne: Team.findOne, routeCreate: DocketRoute.create, routeFindOne: DocketRoute.findOne };
  try {
    const savedRoutes = [];
    DocketRoute.create = async (payload) => { savedRoutes.push(payload); return payload; };
    DocketRoute.findOne = () => ({ sort: async () => ({ returnedAt: null, note: '', save: async () => ({}) }) });

    const routeDocket = { caseId: 'CASE-1', firmId: 'F1', ownerTeamId: 'T1', workbasketId: 'T1', status: 'OPEN', save: async () => routeDocket };
    Case.findOne = async () => routeDocket;
    Team.findOne = ({ firmId, isActive, type }) => ({ select: () => ({ lean: async () => (firmId === 'F1' && isActive && type === 'PRIMARY' ? { _id: 'T3', name: 'Target', isActive: true, type: 'PRIMARY' } : null) }) });

    await svc.routeDocket({ docketId: 'CASE-1', actor: { xID: 'PA1', teamId: 'T1', role: 'PRIMARY_ADMIN' }, firmId: 'F1', toTeamId: 'T3', note: 'Route now' });
    assert.equal(routeDocket.ownerTeamId, 'T3');
    assert.equal(routeDocket.workbasketId, 'T3');
    assert.equal(routeDocket.routedToTeamId, 'T3');
    assert.equal(routeDocket.routeOriginatorTeamId, 'T1');
    assert.equal(savedRoutes[0].fromTeamId, 'T1');

    await assert.rejects(() => svc.routeDocket({ docketId: 'CASE-1', actor: { xID: 'X1', teamId: 'T1', role: 'USER' }, firmId: 'OTHER', toTeamId: 'T3', note: 'x' }));

    const submitDocket = { caseId: 'CASE-2', firmId: 'F1', ownerTeamId: 'T3', workbasketId: 'T3', routedToTeamId: 'T3', assignedToXID: 'X2', routeOriginatorUserXID: 'X1', routeOriginatorTeamId: 'T1', routeOriginatorWorkbasketId: 'T1', save: async () => submitDocket };
    Case.findOne = async ({ caseId }) => (caseId === 'CASE-2' ? submitDocket : routeDocket);
    await svc.returnRoutedDocket({ docketId: 'CASE-2', actor: { xID: 'X2', teamId: 'T3' }, firmId: 'F1', note: 'Done by team' });
    assert.equal(submitDocket.assignedToXID, 'X1');
    assert.equal(submitDocket.routedToTeamId, null);
    assert.equal(submitDocket.ownerTeamId, 'T1');
    assert.equal(submitDocket.workbasketId, 'T1');

    await assert.rejects(() => svc.transitionRoutedTeamStatus({ docketId: 'CASE-2', actor: { teamId: 'T3' }, firmId: 'F1', status: 'FILED' }));

    console.log('docket routing route+submit checks passed');
  } finally {
    Case.findOne = original.caseFindOne; Team.findOne = original.teamFindOne; DocketRoute.create = original.routeCreate; DocketRoute.findOne = original.routeFindOne;
  }
})();
