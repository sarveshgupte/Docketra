#!/usr/bin/env node
const assert = require('assert');

const Task = require('../src/models/Task');
const TaskRepository = require('../src/repositories/TaskRepository');

const makeQueryChain = () => ({
  populate() { return this; },
  limit() { return this; },
  skip() { return this; },
  sort() { return this; },
});

async function testFindScopesFirmId() {
  const originalFind = Task.find;
  let capturedQuery = null;

  Task.find = (query) => {
    capturedQuery = query;
    return makeQueryChain();
  };

  try {
    TaskRepository.find('firm-123', { status: 'pending' }, { page: 2, limit: 10 });
    assert.deepStrictEqual(capturedQuery, { firmId: 'firm-123', status: 'pending' });
  } finally {
    Task.find = originalFind;
  }
}

async function testFindByIdScopesFirmId() {
  const originalFindOne = Task.findOne;
  let capturedQuery = null;

  Task.findOne = (query) => {
    capturedQuery = query;
    return makeQueryChain();
  };

  try {
    TaskRepository.findById('firm-456', 'task-1');
    assert.deepStrictEqual(capturedQuery, { _id: 'task-1', firmId: 'firm-456' });
  } finally {
    Task.findOne = originalFindOne;
  }
}

async function testCreateInjectsFirmId() {
  const originalCreate = Task.create;
  let capturedData = null;

  Task.create = async (data) => {
    capturedData = data;
    return { _id: 'new-task' };
  };

  try {
    await TaskRepository.create('firm-789', { title: 'A Task' });
    assert.deepStrictEqual(capturedData, { title: 'A Task', firmId: 'firm-789' });
  } finally {
    Task.create = originalCreate;
  }
}

async function testAggregateIncludesFirmScope() {
  const originalAggregate = Task.aggregate;
  let capturedPipeline = null;

  Task.aggregate = async (pipeline) => {
    capturedPipeline = pipeline;
    return [];
  };

  try {
    await TaskRepository.aggregateByStatus('firm-abc');
    assert.deepStrictEqual(capturedPipeline[0], { $match: { firmId: 'firm-abc' } });
  } finally {
    Task.aggregate = originalAggregate;
  }
}

async function testTenantRequired() {
  assert.throws(() => TaskRepository.count(null), /TenantId required/);
}

async function run() {
  await testFindScopesFirmId();
  await testFindByIdScopesFirmId();
  await testCreateInjectsFirmId();
  await testAggregateIncludesFirmScope();
  await testTenantRequired();
  console.log('taskRepository tests passed');
}

run().catch((err) => {
  console.error('taskRepository tests failed:', err);
  process.exit(1);
});
