'use strict';

const assert = require('assert');
const { persistClientProfileOrRollback } = require('../src/services/clientProfileWriteGuard.service');

(async () => {
  const helper = persistClientProfileOrRollback;
  assert.equal(typeof helper, 'function', 'persistClientProfileOrRollback helper should be exported');

  let rollbackUpdated = false;
  let deleted = false;
  const fakeRepository = {
    updateById: async () => {
      rollbackUpdated = true;
      return { acknowledged: true };
    },
  };
  const fakeProfileService = {
    createClientProfile: async () => {
      throw new Error('profile-write-failed');
    },
  };

  const fakeClient = {
    _id: '507f1f77bcf86cd799439011',
    deleteOne: async () => {
      deleted = true;
    },
  };

  let failed = false;
  try {
    await helper({
      firmId: '507f1f77bcf86cd799439012',
      client: fakeClient,
      actorXID: 'X001',
      profileInput: {},
      repository: fakeRepository,
      profileService: fakeProfileService,
    });
  } catch (error) {
    failed = error.message === 'profile-write-failed';
  }

  assert.equal(failed, true, 'helper should rethrow profile storage failure');
  assert.equal(rollbackUpdated, true, 'helper should mark rollback state in repository');
  assert.equal(deleted, true, 'helper should delete orphan client record');

  console.log('client.create.rollback.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
