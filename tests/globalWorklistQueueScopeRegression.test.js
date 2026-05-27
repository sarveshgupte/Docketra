const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/controllers/search.controller.js'), 'utf8');

assert.ok(
  source.includes('{ workbasketId: selectedTeamId }')
    && source.includes('{ ownerTeamId: selectedTeamId }')
    && source.includes('{ routedToTeamId: selectedTeamId }'),
  'globalWorklist must scope selected team by workbasketId, ownerTeamId, and routedToTeamId.'
);

assert.ok(
  source.includes('const andClauses = [];')
    && source.includes('query.$and = [...(Array.isArray(query.$and) ? query.$and : []), ...andClauses];'),
  'globalWorklist should compose team + SLA filters using query.$and to avoid $or collisions.'
);

console.log('globalWorklistQueueScopeRegression.test.js passed');
