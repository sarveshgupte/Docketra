const assert = require('assert');
const { reopenDuePending } = require('./src/services/docketWorkflow.service.js');
const Case = require('./src/models/Case.model.js');
const docketAuditService = require('./src/services/docketAudit.service.js');
const mongoose = require('mongoose');

async function run() {
  mongoose.connection.readyState = 1;
  let observedFindFilter = null;
  Case.find = async (filter) => {
    observedFindFilter = filter;
    return [];
  };

  await reopenDuePending();
  console.log("observedFindFilter:", JSON.stringify(observedFindFilter, null, 2));
  assert.ok(observedFindFilter?.status === 'PENDING' || (observedFindFilter?.status?.$in && observedFindFilter.status.$in.includes('PENDING')));
  console.log("First assertion passed");
}

run().catch(console.error);
