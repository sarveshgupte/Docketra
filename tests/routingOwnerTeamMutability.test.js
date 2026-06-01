#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');

const doc = Case.hydrate({
  _id: new mongoose.Types.ObjectId(),
  caseInternalId: new mongoose.Types.ObjectId(),
  caseId: 'DOCKET-20260526-00001',
  caseNumber: 'DOCKET-20260526-00001',
  title: 'Routing mutability check',
  clientId: 'C000001',
  category: 'Tax',
  subcategory: 'GST',
  createdByXID: 'X000001',
  firmId: new mongoose.Types.ObjectId(),
  ownerTeamId: new mongoose.Types.ObjectId('60d5ec49f3e1a329dc3309a1'),
  workbasketId: new mongoose.Types.ObjectId('60d5ec49f3e1a329dc3309a1'),
});

const nextOwnerTeamId = new mongoose.Types.ObjectId('60d5ec49f3e1a329dc3309a2');
doc.ownerTeamId = nextOwnerTeamId;

assert.strictEqual(String(doc.ownerTeamId), String(nextOwnerTeamId), 'ownerTeamId should be mutable for routing workflows');
assert.ok(doc.modifiedPaths().includes('ownerTeamId'), 'ownerTeamId should be tracked as modified after routing update');

console.log('routingOwnerTeamMutability.test.js passed');
