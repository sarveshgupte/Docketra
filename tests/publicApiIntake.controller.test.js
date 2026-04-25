#!/usr/bin/env node
const assert = require('assert');

const controllerPath = require.resolve('../src/controllers/publicIntake.controller');
const firmModelPath = require.resolve('../src/models/Firm.model');
const intakeServicePath = require.resolve('../src/services/cmsIntake.service');

function loadController({ firmMock, serviceMock }) {
  delete require.cache[controllerPath];
  require.cache[firmModelPath] = { exports: firmMock };
  require.cache[intakeServicePath] = { exports: serviceMock };
  return require(controllerPath);
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

async function testRejectsMissingOrInvalidAuth() {
  const firmRecord = {
    _id: '507f1f77bcf86cd799439011',
    intakeConfig: { cms: { intakeApiEnabled: true, intakeApiKey: 'my-secret' } },
  };
  const controller = loadController({
    firmMock: {
      findOne: () => ({ select: () => ({ lean: async () => firmRecord }) }),
    },
    serviceMock: {
      processCmsSubmission: async () => ({ lead: { _id: 'lead-x' }, metadata: { warnings: [] } }),
    },
  });

  {
    const req = { params: { firmSlug: 'firm-one' }, headers: {}, body: {}, query: {}, socket: {}, get: () => null };
    const res = createRes();
    await controller.submitApiIntake(req, res);
    assert.strictEqual(res.statusCode, 401);
  }

  {
    const req = {
      params: { firmSlug: 'firm-one' },
      headers: { 'x-docketra-intake-key': 'wrong' },
      body: { name: 'bad' },
      query: {},
      socket: {},
      get: () => null,
    };
    const res = createRes();
    await controller.submitApiIntake(req, res);
    assert.strictEqual(res.statusCode, 401);
  }
}

async function testAcceptsValidRequestAndMapsResponse() {
  let captured = null;
  const firmRecord = {
    _id: '507f1f77bcf86cd799439011',
    intakeConfig: { cms: { intakeApiEnabled: true, intakeApiKey: 'my-secret' } },
  };
  const controller = loadController({
    firmMock: {
      findOne: () => ({ select: () => ({ lean: async () => firmRecord }) }),
    },
    serviceMock: {
      processCmsSubmission: async (input) => {
        captured = input;
        return {
          lead: { _id: 'lead-1' },
          client: { clientId: 'C000100' },
          docket: { caseId: 'CASE-1' },
          metadata: { warnings: [] },
        };
      },
    },
  });

  const req = {
    params: { firmSlug: 'firm-one' },
    headers: { 'x-docketra-intake-key': 'my-secret', 'idempotency-key': 'idem-1' },
    body: {
      name: 'A',
      email: 'a@example.com',
      service: 'Tax',
      externalSubmissionId: 'ext-1',
      customField: 'abc',
    },
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
    ip: '127.0.0.1',
    get: () => 'UA',
  };
  const res = createRes();

  await controller.submitApiIntake(req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(res.payload.leadId, 'lead-1');
  assert.strictEqual(res.payload.clientId, 'C000100');
  assert.strictEqual(res.payload.docketId, 'CASE-1');
  assert.strictEqual(captured.submissionMode, 'api_intake');
  assert.strictEqual(String(captured.firmId), firmRecord._id);
  assert.strictEqual(captured.requestMeta.idempotencyKey, 'ext-1');
}

async function testReplayResponseUses200() {
  const firmRecord = {
    _id: '507f1f77bcf86cd799439011',
    intakeConfig: { cms: { intakeApiEnabled: true, intakeApiKey: 'my-secret' } },
  };
  const controller = loadController({
    firmMock: {
      findOne: () => ({ select: () => ({ lean: async () => firmRecord }) }),
    },
    serviceMock: {
      processCmsSubmission: async () => ({
        lead: { _id: 'lead-existing' },
        metadata: { warnings: ['dup'], idempotentReplay: true },
      }),
    },
  });

  const req = {
    params: { firmSlug: 'firm-one' },
    headers: { 'x-docketra-intake-key': 'my-secret' },
    body: { name: 'A', idempotencyKey: 'idem-2' },
    query: {},
    socket: {},
    get: () => null,
  };
  const res = createRes();
  await controller.submitApiIntake(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload.idempotentReplay, true);
}


async function testFirmIdIsAlwaysResolvedFromSlug() {
  let captured = null;
  const firmRecord = {
    _id: '507f1f77bcf86cd799439011',
    intakeConfig: { cms: { intakeApiEnabled: true, intakeApiKey: 'my-secret' } },
  };
  const controller = loadController({
    firmMock: {
      findOne: () => ({ select: () => ({ lean: async () => firmRecord }) }),
    },
    serviceMock: {
      processCmsSubmission: async (input) => {
        captured = input;
        return { lead: { _id: 'lead-safe' }, metadata: { warnings: [] } };
      },
    },
  });

  const req = {
    params: { firmSlug: 'firm-one' },
    headers: { 'x-docketra-intake-key': 'my-secret' },
    body: { name: 'A', firmId: 'malicious-firm', clientId: 'malicious-client' },
    query: {},
    socket: {},
    get: () => null,
  };
  const res = createRes();
  await controller.submitApiIntake(req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(String(captured.firmId), firmRecord._id);
  assert.strictEqual(captured.payload.firmId, 'malicious-firm');
  assert.strictEqual(captured.payload.clientId, 'malicious-client');
}

async function run() {
  try {
    await testRejectsMissingOrInvalidAuth();
    await testAcceptsValidRequestAndMapsResponse();
    await testReplayResponseUses200();
    await testFirmIdIsAlwaysResolvedFromSlug();
    console.log('Public API intake controller tests passed.');
  } catch (error) {
    console.error('Public API intake controller tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[controllerPath];
    delete require.cache[firmModelPath];
    delete require.cache[intakeServicePath];
  }
}

run();
