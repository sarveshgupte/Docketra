const assert = require('assert');

const Case = require('../src/models/Case.model');
const Team = require('../src/models/Team.model');
const DocketRoute = require('../src/models/DocketRoute.model');
const svc = require('../src/services/docketRouting.service');

(async () => {
  const original = {
    caseFindOne: Case.findOne,
    teamFindOne: Team.findOne,
    routeCreate: DocketRoute.create,
    routeFindOne: DocketRoute.findOne,
  };

  try {
    const docket = {
      caseId: 'CASE-1', firmId: 'F1', ownerTeamId: 'T1', routedToTeamId: 'T2',
      assignedToXID: 'X2', status: 'OPEN', state: 'IN_PROGRESS', queueType: 'PERSONAL',
      routeOriginatorUserXID: 'X1', save: async () => docket,
    };
    Case.findOne = async () => docket;
    Team.findOne = () => ({ select: () => ({ lean: async () => ({ _id: 'T3', name: 'Target', isActive: true, type: 'PRIMARY' }) }) });
    DocketRoute.create = async () => ({});
    DocketRoute.findOne = () => ({ sort: async () => ({ returnedAt: null, note: '', save: async () => ({}) }) });

    await assert.rejects(() => svc.routeDocket({ docketId: 'CASE-1', actor: { xID: 'X1', teamId: 'T1', role: 'USER' }, firmId: 'F1', toTeamId: 'T3', note: '' }));

    await svc.returnRoutedDocket({ docketId: 'CASE-1', actor: { xID: 'X2', teamId: 'T2' }, firmId: 'F1', note: 'Done by team' });
    assert.equal(docket.assignedToXID, 'X1');
    assert.equal(docket.queueType, 'PERSONAL');
    assert.equal(docket.state, 'IN_PROGRESS');
    assert.equal(docket.status, 'IN_PROGRESS');

    console.log('docket routing route+submit checks passed');
  } finally {
    Case.findOne = original.caseFindOne;
    Team.findOne = original.teamFindOne;
    DocketRoute.create = original.routeCreate;
    DocketRoute.findOne = original.routeFindOne;
  }
})();
