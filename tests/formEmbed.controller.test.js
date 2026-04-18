#!/usr/bin/env node
const assert = require('assert');

const controllerPath = require.resolve('../src/controllers/form.controller');
const formModelPath = require.resolve('../src/models/Form.model');
const cmsServicePath = require.resolve('../src/services/cmsIntake.service');

function loadController({ formMock, cmsMock }) {
  delete require.cache[controllerPath];
  require.cache[formModelPath] = { exports: formMock };
  require.cache[cmsServicePath] = { exports: cmsMock };
  return require(controllerPath);
}

function createFindByIdMock(record) {
  return () => ({ lean: async () => record });
}

function mockResponse() {
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

async function testEmbedSubmissionUsesUnifiedIntakeFlow() {
  let captured = null;
  const formController = loadController({
    formMock: {
      findById: createFindByIdMock({
        _id: '507f1f77bcf86cd799439011',
        firmId: '507f1f77bcf86cd799439012',
        isActive: true,
        allowEmbed: true,
        successMessage: 'Done',
        redirectUrl: '',
        allowedEmbedDomains: ['firm.com'],
      }),
    },
    cmsMock: {
      processCmsSubmission: async (payload) => {
        captured = payload;
        return { lead: { _id: 'lead-1' } };
      },
    },
  });

  const req = {
    params: { id: '507f1f77bcf86cd799439011' },
    query: { embed: 'true' },
    headers: { referer: 'https://portal.firm.com/intake' },
    body: { name: 'Alice', email: 'alice@example.com', pageUrl: 'https://portal.firm.com/intake' },
    socket: { remoteAddress: '127.0.0.1' },
    ip: '127.0.0.1',
  };
  const res = mockResponse();

  await formController.submitForm(req, res);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload.data.submissionMode, 'embedded_form');
  assert.strictEqual(captured.submissionMode, 'embedded_form');
  assert.strictEqual(captured.payload.source, 'website_embed');
  assert.strictEqual(captured.payload.formId, '507f1f77bcf86cd799439011');
}

async function testInactiveOrEmbedDisabledFormsAreRejected() {
  {
    const formController = loadController({
      formMock: { findById: createFindByIdMock({ isActive: false, allowEmbed: true }) },
      cmsMock: { processCmsSubmission: async () => ({ lead: { _id: 'x' } }) },
    });
    const req = { params: { id: '507f1f77bcf86cd799439011' }, query: {}, body: { name: 'N' }, headers: {}, socket: {} };
    const res = mockResponse();
    await formController.submitForm(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.payload.message, /not active/i);
  }

  {
    const formController = loadController({
      formMock: { findById: createFindByIdMock({ _id: '507f1f77bcf86cd799439011', firmId: '507f1f77bcf86cd799439012', isActive: true, allowEmbed: false }) },
      cmsMock: { processCmsSubmission: async () => ({ lead: { _id: 'x' } }) },
    });
    const req = { params: { id: '507f1f77bcf86cd799439011' }, query: { embed: 'true' }, body: { name: 'N' }, headers: {}, socket: {} };
    const res = mockResponse();
    await formController.submitForm(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.payload.message, /Embed is not enabled/i);
  }
}

async function testGetPublicFormSupportsEmbedMode() {
  const formController = loadController({
    formMock: {
      findById: createFindByIdMock({
        _id: '507f1f77bcf86cd799439011',
        name: 'Client Intake',
        fields: [{ key: 'name', label: 'Name', type: 'text' }],
        isActive: true,
        allowEmbed: true,
        embedTitle: 'Start your intake',
        successMessage: 'Submitted',
        redirectUrl: 'https://firm.com/thanks',
        themeMode: 'light',
      }),
    },
    cmsMock: { processCmsSubmission: async () => ({ lead: { _id: 'x' } }) },
  });

  const req = { params: { id: '507f1f77bcf86cd799439011' }, query: { embed: 'true' } };
  const res = mockResponse();
  await formController.getPublicForm(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload.data.embedMode, true);
  assert.strictEqual(res.payload.data.redirectUrl, 'https://firm.com/thanks');
}

async function run() {
  try {
    await testEmbedSubmissionUsesUnifiedIntakeFlow();
    await testInactiveOrEmbedDisabledFormsAreRejected();
    await testGetPublicFormSupportsEmbedMode();
    console.log('Form embed controller tests passed.');
  } catch (error) {
    console.error('Form embed controller tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[controllerPath];
    delete require.cache[formModelPath];
    delete require.cache[cmsServicePath];
  }
}

run();
