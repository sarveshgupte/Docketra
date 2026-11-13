#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  generateCharges,
  lookupCompany,
  testGatewayConnection,
} = require('../src/services/mca.service');
const { normalizeFirmSettings, DEFAULT_FIRM_SETTINGS } = require('../src/services/adminController.service');
const clientSchemas = require('../src/schemas/client.routes.schema');
const adminSchemas = require('../src/schemas/admin.routes.schema');

(async () => {
  console.log('Running MCA Phase 3 Features tests...');

  // 1. Test Index of Charges generation
  const charges = generateCharges('368291', 2021);
  assert.ok(Array.isArray(charges), 'generateCharges must return an array');
  assert.ok(charges.length >= 2, 'Should generate at least 2 bank charges');

  const openCharge = charges.find((c) => c.status === 'Open');
  assert.ok(openCharge, 'Should have an active open charge');
  assert.ok(openCharge.chargeId.startsWith('CHG-'), 'Charge ID should have CHG- prefix');
  assert.ok(openCharge.chargeHolder.includes('Bank'), 'Charge holder should be an institutional lender');
  assert.ok(openCharge.amount >= 1000000, 'Charge amount should reflect corporate lending scale');
  assert.ok(openCharge.assetHypothecated.length > 10, 'Asset hypothecated should describe security');
  assert.strictEqual(openCharge.dateOfSatisfaction, null, 'Open charge should have null dateOfSatisfaction');

  const satisfiedCharge = charges.find((c) => c.status === 'Satisfied');
  assert.ok(satisfiedCharge, 'Should have a satisfied historical charge');
  assert.ok(satisfiedCharge.dateOfSatisfaction instanceof Date, 'Satisfied charge should have dateOfSatisfaction');

  // 2. Deterministic lookupCompany includes charges
  const company = await lookupCompany({ cin: 'U72900MH2021PTC368291' });
  assert.ok(Array.isArray(company.charges), 'Dossier must contain charges array');
  assert.strictEqual(company.charges.length, charges.length, 'Charges length should match');

  // 3. Firm MCA Gateway Settings normalization
  const defaultNormalized = normalizeFirmSettings({});
  assert.deepStrictEqual(defaultNormalized.mcaGateway, DEFAULT_FIRM_SETTINGS.mcaGateway);
  assert.strictEqual(defaultNormalized.mcaGateway.provider, 'sandbox');
  assert.strictEqual(defaultNormalized.mcaGateway.cacheTtlDays, 30);

  const customNormalized = normalizeFirmSettings({
    mcaGateway: {
      provider: 'surepass',
      apiKey: 'test-api-key-999',
      apiUrl: 'https://kyc.surepass.io/api/v1/corporate/mca',
      cacheTtlDays: 60,
    },
  });
  assert.strictEqual(customNormalized.mcaGateway.provider, 'surepass');
  assert.strictEqual(customNormalized.mcaGateway.apiKey, 'test-api-key-999');
  assert.strictEqual(customNormalized.mcaGateway.apiUrl, 'https://kyc.surepass.io/api/v1/corporate/mca');
  assert.strictEqual(customNormalized.mcaGateway.cacheTtlDays, 60);

  // 4. Test Gateway Connection tester
  const sandboxTest = await testGatewayConnection({ provider: 'sandbox' });
  assert.strictEqual(sandboxTest.success, true);
  assert.strictEqual(sandboxTest.provider, 'sandbox');

  await assert.rejects(
    async () => {
      await testGatewayConnection({ provider: 'karza', apiKey: '' });
    },
    /API Key is required/
  );

  // 5. Schema validation for POST /:clientId/mca/send-alarm
  const alarmSchema = clientSchemas['POST /:clientId/mca/send-alarm'];
  assert.ok(alarmSchema, 'client.routes.schema must define schema for POST /:clientId/mca/send-alarm');

  // Valid alarm payload
  const validAlarm = alarmSchema.body.safeParse({
    formName: 'DIR-3 KYC',
    channels: ['email', 'whatsapp'],
    recipientEmail: 'compliance@example.com',
    recipientPhone: '9820012345',
    targetDirectors: ['Aditya Sharma (DIN 01234567)'],
  });
  assert.strictEqual(validAlarm.success, true, 'Valid alarm payload should parse successfully');

  // Invalid alarm payload: empty formName
  const invalidAlarm = alarmSchema.body.safeParse({
    formName: '',
    channels: ['email'],
  });
  assert.strictEqual(invalidAlarm.success, false, 'Empty formName should fail validation');

  // Invalid channel
  const invalidChannel = alarmSchema.body.safeParse({
    formName: 'AOC-4',
    channels: ['telegram'],
  });
  assert.strictEqual(invalidChannel.success, false, 'Invalid channel enum should fail validation');

  // 6. Schema validation for PUT /firm-settings with mcaGateway
  const firmSettingsSchema = adminSchemas['PUT /firm-settings'];
  assert.ok(firmSettingsSchema, 'admin.routes.schema must define schema for PUT /firm-settings');
  const validFirmSettings = firmSettingsSchema.body.safeParse({
    firm: {
      mcaGateway: {
        provider: 'surepass',
        apiKey: 'key_123',
        apiUrl: 'https://api.example.com',
        cacheTtlDays: 45,
      },
    },
  });
  assert.strictEqual(validFirmSettings.success, true, 'PUT /firm-settings with mcaGateway should be accepted');

  console.log('✓ All MCA Phase 3 Features tests passed successfully!');
})();
