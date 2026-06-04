'use strict';

const assert = require('assert');
const Task = require('../src/models/Task');
const TaskRepository = require('../src/repositories/TaskRepository');

async function testTaskDescriptionPersistenceBlocked() {
  const task = new Task({
    title: 'Test Calendar Task',
    firmId: '507f1f77bcf86cd799439011',
    description: 'Sensitive firm business narrative',
    createdBy: '507f1f77bcf86cd799439012',
  });

  let blocked = false;
  try {
    await task.validate();
  } catch (error) {
    const messages = [
      error?.message,
      ...(error?.errors ? Object.values(error.errors).map((entry) => entry?.message) : []),
    ]
      .filter(Boolean)
      .join(' | ');
    blocked = messages.includes('BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED:description');
  }

  assert.strictEqual(blocked, true, 'Task description persistence must be blocked at schema validation');
}

async function testTaskRepositoryAssertsDescription() {
  let blocked = false;
  try {
    TaskRepository._assertNoSensitivePersistence({
      title: 'Valid Title',
      description: 'Some desc',
    });
  } catch (error) {
    blocked = error.code === 'BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED';
  }
  assert.strictEqual(blocked, true, 'TaskRepository must assert against writing description');
}

(async () => {
  await testTaskDescriptionPersistenceBlocked();
  await testTaskRepositoryAssertsDescription();
  console.log('task.byosEnforcement.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
