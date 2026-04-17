#!/usr/bin/env node
/**
 * UNIT TEST: user.controller.getUserById
 *
 * This test uses the project's established pattern of overriding Module._load
 * to mock dependencies (especially destructured imports and middleware wrappers
 * like wrapWriteHandler).
 */
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  // 1. Mock middleware that wraps exports
  if (request === '../middleware/wrapWriteHandler') return (fn) => fn;

  // 2. Mock the repository to control data access
  if (request === '../repositories/user.repository') {
    return {
      findUserById: async (...args) => global.mockFindUserById(...args)
    };
  }

  if (request === '../utils/role.utils') {
    return {
      normalizeRole: (role) => {
        if (!role) return null;
        const normalized = String(role).trim().toUpperCase().replace(/[\s-]+/g, '_');
        if (normalized === 'SUPERADMIN' || normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
        if (normalized === 'PRIMARY_ADMIN') return 'PRIMARY_ADMIN';
        if (normalized === 'ADMIN') return 'ADMIN';
        if (normalized === 'MANAGER') return 'MANAGER';
        if (normalized === 'EMPLOYEE' || normalized === 'STAFF' || normalized === 'USER') return 'USER';
        return normalized;
      }
    };
  }

  // 3. Gracefully handle environment-missing dependencies or side-effect heavy imports.
  // Returning a Proxy ensures that property access or function calls on these mocks don't crash
  // during the controller's initialization phase.
  if (request === '../utils/role.utils') {
    return {
      normalizeRole: (r) => r
    };
  }
  if (request === 'mongoose' || request === 'crypto' || request.includes('model') ||
      request.includes('service') || request.includes('utils')) {
     return new Proxy(() => ({}), {
       get: () => () => ({}),
     });
  }

  return originalLoad.apply(this, arguments);
};

const { getUserById } = require('../src/controllers/user.controller');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function run() {
  let passed = 0;
  let failed = 0;

  console.log('🧪 Starting user.controller.getUserById tests...');

  try {
    const mockUser = {
      _id: 'user123',
      name: 'Test User',
      toSafeObject: () => ({ _id: 'user123', name: 'Test User' })
    };

    // ----------------------------------------------------------------------
    // TEST 1: Success - User found
    // ----------------------------------------------------------------------
    console.log('Testing getUserById - Success...');
    global.mockFindUserById = async (id, firmId) => {
      assert.strictEqual(id, 'user123');
      assert.strictEqual(firmId, 'firm123');
      return mockUser;
    };

    const req1 = {
      params: { id: 'user123' },
      user: { firmId: 'firm123' }
    };
    const res1 = createMockRes();

    await getUserById(req1, res1);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.success, true);
    assert.deepStrictEqual(res1.body.data, { _id: 'user123', name: 'Test User' });
    console.log('  ✅ Success case passed');
    passed++;

    // ----------------------------------------------------------------------
    // TEST 2: User Not Found
    // ----------------------------------------------------------------------
    console.log('Testing getUserById - Not Found...');
    global.mockFindUserById = async () => null;

    const req2 = {
      params: { id: 'nonexistent' },
      user: { firmId: 'firm123' }
    };
    const res2 = createMockRes();

    await getUserById(req2, res2);

    assert.strictEqual(res2.statusCode, 404);
    assert.strictEqual(res2.body.success, false);
    assert.strictEqual(res2.body.error, 'User not found');
    console.log('  ✅ Not Found case passed');
    passed++;

    // ----------------------------------------------------------------------
    // TEST 3: Forbidden - Missing Firm Context
    // ----------------------------------------------------------------------
    console.log('Testing getUserById - Forbidden (Missing Firm Context)...');
    const req3 = {
      params: { id: 'user123' },
      user: { role: 'Employee' } // No firmId
    };
    const res3 = createMockRes();

    await getUserById(req3, res3);

    assert.strictEqual(res3.statusCode, 403);
    assert.strictEqual(res3.body.success, false);
    assert.strictEqual(res3.body.message, 'Forbidden: firm context required');
    console.log('  ✅ Forbidden case passed');
    passed++;

    // ----------------------------------------------------------------------
    // TEST 4: Internal Server Error
    // ----------------------------------------------------------------------
    console.log('Testing getUserById - Server Error...');
    global.mockFindUserById = async () => {
      throw new Error('Database connection failed');
    };

    const req4 = {
      params: { id: 'user123' },
      user: { firmId: 'firm123' }
    };
    const res4 = createMockRes();

    await getUserById(req4, res4);

    assert.strictEqual(res4.statusCode, 500);
    assert.strictEqual(res4.body.success, false);
    assert.strictEqual(res4.body.error, 'Error fetching user');
    assert.strictEqual(res4.body.message, 'Database connection failed');
    console.log('  ✅ Server Error case passed');
    passed++;

    // ----------------------------------------------------------------------
    // TEST 5: SUPER_ADMIN context (Global Access)
    // ----------------------------------------------------------------------
    console.log('Testing getUserById - SUPER_ADMIN...');
    global.mockFindUserById = async (id, firmId) => {
      assert.strictEqual(id, 'user123');
      assert.strictEqual(firmId, undefined); // SUPER_ADMIN has no firmId scope
      return mockUser;
    };

    const req5 = {
      params: { id: 'user123' },
      user: { role: 'SUPER_ADMIN' }
    };
    const res5 = createMockRes();

    await getUserById(req5, res5);

    assert.strictEqual(res5.statusCode, 200);
    assert.strictEqual(res5.body.success, true);
    console.log('  ✅ SUPER_ADMIN case passed');
    passed++;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    failed++;
  } finally {
    Module._load = originalLoad;
  }

  console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(console.error);
