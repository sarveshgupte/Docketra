const assert = require('assert');
const { isRoutedTeamCannotResolve } = require('../ui/src/pages/caseDetail/caseDetailAccess.js');

(() => {
  const receiving = isRoutedTeamCannotResolve({
    caseInfo: { routedToTeamId: 'LEGAL', ownerTeamId: 'LEGAL', routeOriginatorTeamId: 'HR' },
    user: { teamId: 'LEGAL' },
  });
  assert.equal(receiving, true, 'Receiving routed user should be restricted from resolve/file');

  const origin = isRoutedTeamCannotResolve({
    caseInfo: { routedToTeamId: null, ownerTeamId: 'HR', routeOriginatorTeamId: null },
    user: { teamId: 'HR' },
  });
  assert.equal(origin, false, 'Origin owner should retain normal resolve/file when not routed');

  console.log('caseDetailAccess route submit checks passed');
})();
