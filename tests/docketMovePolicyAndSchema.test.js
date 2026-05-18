#!/usr/bin/env node
const assert = require('assert');
const routeSchemas = require('../src/schemas/case.routes.schema');
const { canMoveDocketBetweenQueues } = require('../src/services/workbasketAuthorization.service');

function testPolicy() {
  const docket = { status: 'OPEN', state: 'IN_WB' };
  assert.strictEqual(canMoveDocketBetweenQueues({ viewer: { role: 'USER' }, docket, destination: { type: 'WORKBASKET' } }), false);
  assert.strictEqual(canMoveDocketBetweenQueues({ viewer: { role: 'MANAGER' }, docket, destination: { type: 'WORKBASKET' } }), true);
  assert.strictEqual(canMoveDocketBetweenQueues({ viewer: { role: 'ADMIN' }, docket: { status: 'RESOLVED' }, destination: { type: 'WORKBASKET' } }), false);
}

function testSchema() {
  const schema = routeSchemas['POST /:caseId/move'].body;
  const okUser = schema.safeParse({ destinationType: 'USER_WORKLIST', assigneeXID: 'X123456' });
  assert.strictEqual(okUser.success, true);
  const okQueue = schema.safeParse({ destinationType: 'WORKBASKET', destinationId: '507f191e810c19729de860ea' });
  assert.strictEqual(okQueue.success, true);
  const unknown = schema.safeParse({ destinationType: 'WORKBASKET', destinationId: '507f191e810c19729de860ea', extra: true });
  assert.strictEqual(unknown.success, false);
}

function run() {
  try {
    testPolicy();
    testSchema();
    console.log('Docket move policy/schema tests passed.');
  } catch (error) {
    console.error('Docket move policy/schema tests failed:', error);
    process.exit(1);
  }
}

run();
