#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const notificationSocketService = require('../src/services/notificationSocket.service');

function createSocket(id, identity) {
  return {
    id,
    data: { notificationIdentity: identity },
    disconnectCalls: 0,
    disconnect(force) {
      if (force) this.disconnectCalls += 1;
    },
  };
}

function run() {
  const { setIoInstanceForTests, resetSocketSchedulerForTests, startSocketRevalidationScheduler, stopSocketRevalidationSchedulerIfIdle, socketMetaById } = notificationSocketService.__private;

  const socketA = createSocket('a', { firmId: 'firm-1', userMongoId: 'u-1', userId: 'DK-A' });
  const socketB = createSocket('b', { firmId: 'firm-1', userMongoId: 'u-2', userId: 'DK-B' });
  const socketC = createSocket('c', { firmId: 'firm-2', userMongoId: 'u-1', userId: 'DK-A' });

  setIoInstanceForTests({
    sockets: {
      sockets: new Map([
        ['a', socketA],
        ['b', socketB],
        ['c', socketC],
      ]),
    },
  });

  notificationSocketService.disconnectUserSockets({ firmId: 'firm-1', userMongoId: 'u-1' });
  assert.strictEqual(socketA.disconnectCalls, 1, 'matching firm+user socket should disconnect');
  assert.strictEqual(socketB.disconnectCalls, 0, 'same firm different user should remain connected');
  assert.strictEqual(socketC.disconnectCalls, 0, 'different firm should remain connected');

  // Scheduler can start and stop cleanly (no leaked timer when no sockets tracked)
  socketMetaById.clear();
  startSocketRevalidationScheduler();
  stopSocketRevalidationSchedulerIfIdle();
  resetSocketSchedulerForTests();
  setIoInstanceForTests(null);

  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'notificationSocket.service.js'), 'utf8');
  assert(!source.includes("ioInstance.on('connection', () => {})"), 'no duplicate no-op connection handler should be registered');

  console.log('notificationSocketSessionLifecycle behavior tests passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
