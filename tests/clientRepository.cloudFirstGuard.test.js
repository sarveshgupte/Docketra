const assert = require('assert');
const ClientRepository = require('../src/repositories/ClientRepository');

const prohibitedPayload = {
  businessName: 'Acme',
  businessEmail: 'a@b.com',
  primaryContactNumber: '999',
  businessAddress: 'Addr',
  PAN: 'PAN',
  TAN: 'TAN',
  GST: 'GST',
  CIN: 'CIN',
  contactPersonName: 'Name',
  contactPersonDesignation: 'CEO',
  contactPersonPhoneNumber: '123',
  contactPersonEmailAddress: 'cp@a.com',
  clientFactSheet: { description: 'x' },
};

for (const [field, value] of Object.entries(prohibitedPayload)) {
  let blocked = false;
  try {
    ClientRepository._assertNoSensitivePersistence({ [field]: value });
  } catch (error) {
    blocked = error.code === 'BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED';
  }
  assert.strictEqual(blocked, true, `Expected field to be blocked: ${field}`);
}

console.log('clientRepository.cloudFirstGuard test passed');
