#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const servicePath = require.resolve('../src/services/crmClientMapping.service');
const controllerPath = require.resolve('../src/controllers/crmClient.controller');

async function testCrmClientRestrictionEnforcement() {
  console.log('Testing CRM Client restriction enforcement on detail and update endpoints...');

  const firmId = new mongoose.Types.ObjectId();
  const restrictedClientId = new mongoose.Types.ObjectId();
  const allowedClientId = new mongoose.Types.ObjectId();

  delete require.cache[controllerPath];
  delete require.cache[servicePath];

  const crmMappingService = require('../src/services/crmClientMapping.service');
  crmMappingService.resolveClientAndLegacyCrm = async ({ inputId }) => {
    return {
      client: {
        _id: inputId,
        clientId: 'C100',
        businessName: 'Target Client',
        legacyCrmClientId: new mongoose.Types.ObjectId(),
        toObject: () => ({ _id: inputId, businessName: 'Target Client' }),
        save: async () => {},
      },
      crmClient: null,
    };
  };

  const crmClientController = require('../src/controllers/crmClient.controller');

  // Mock DB models used in detail queries
  const Deal = require('../src/models/Deal.model');
  const Case = require('../src/models/Case.model');
  const Invoice = require('../src/models/Invoice.model');

  const originalDealFind = Deal.find;
  const originalCaseFind = Case.find;
  const originalInvoiceFind = Invoice.find;

  Deal.find = () => ({ sort: () => ({ lean: async () => [] }) });
  Case.find = () => ({ sort: () => ({ lean: async () => [] }) });
  Invoice.find = () => ({ sort: () => ({ lean: async () => [] }) });

  function createMockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
  }

  try {
    // 1. Staff user attempting to access restricted client via getCrmClientById
    const getReq = {
      params: { id: restrictedClientId.toString() },
      user: {
        firmId,
        role: 'MEMBER',
        clientAccess: [allowedClientId.toString()],
        restrictedClientIds: [restrictedClientId.toString()],
      },
    };
    const getRes = createMockRes();
    await crmClientController.getCrmClientById(getReq, getRes);

    assert.strictEqual(getRes.statusCode, 403, 'Should reject access to restricted CRM client with 403');
    assert.strictEqual(getRes.jsonData.code, 'CLIENT_ACCESS_RESTRICTED');
    console.log('✓ getCrmClientById returns 403 CLIENT_ACCESS_RESTRICTED for unauthorized client');

    // 2. Staff user attempting to update restricted client via updateCrmClient
    const updateReq = {
      params: { id: restrictedClientId.toString() },
      body: { name: 'Malicious Update' },
      user: {
        firmId,
        role: 'MEMBER',
        clientAccess: [allowedClientId.toString()],
        restrictedClientIds: [restrictedClientId.toString()],
      },
    };
    const updateRes = createMockRes();
    await crmClientController.updateCrmClient(updateReq, updateRes);

    assert.strictEqual(updateRes.statusCode, 403, 'Should reject update to restricted CRM client with 403');
    assert.strictEqual(updateRes.jsonData.code, 'CLIENT_ACCESS_RESTRICTED');
    console.log('✓ updateCrmClient returns 403 CLIENT_ACCESS_RESTRICTED for unauthorized client');

    // 3. User with valid client permission succeeds
    const allowedReq = {
      params: { id: allowedClientId.toString() },
      user: {
        firmId,
        role: 'MEMBER',
        clientAccess: [allowedClientId.toString()],
        restrictedClientIds: [],
      },
    };
    const allowedRes = createMockRes();
    await crmClientController.getCrmClientById(allowedReq, allowedRes);
    assert.strictEqual(allowedRes.statusCode, 200, 'Should allow access to assigned client');
    console.log('✓ getCrmClientById allows authorized client access');

  } finally {
    Deal.find = originalDealFind;
    Case.find = originalCaseFind;
    Invoice.find = originalInvoiceFind;
    delete require.cache[controllerPath];
    delete require.cache[servicePath];
  }
}

async function run() {
  try {
    await testCrmClientRestrictionEnforcement();
    console.log('All CRM Client security tests passed successfully!');
  } catch (error) {
    console.error('CRM Client security tests failed:', error);
    process.exit(1);
  }
}

run();
