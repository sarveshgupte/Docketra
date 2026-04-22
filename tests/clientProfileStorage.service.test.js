'use strict';

const assert = require('assert');
const { clientProfileStorageService } = require('../src/services/clientProfileStorage.service');

(function testHydrateClientWithProfile() {
  const client = {
    clientId: 'C000123',
    businessName: 'Acme Pvt Ltd',
    businessEmail: 'ops@acme.com',
    primaryContactNumber: '99999',
  };

  const payload = {
    profile: {
      identifiers: { pan: 'ABCDE1234F', cin: 'L12345', gstin: '22AAAAA0000A1Z5', tan: 'ABCD12345E' },
      contacts: {
        primaryEmail: 'legal@acme.com',
        primaryPhone: '88888',
        secondaryPhone: '77777',
        contactPerson: {
          name: 'Jane',
          designation: 'Manager',
          phone: '66666',
          email: 'jane@acme.com',
        },
      },
      addresses: { businessAddress: 'HQ Address' },
      factSheet: { description: 'Sensitive' },
    },
  };

  const hydrated = clientProfileStorageService.hydrateClientWithProfile(client, payload);
  assert.equal(hydrated.PAN, 'ABCDE1234F');
  assert.equal(hydrated.CIN, 'L12345');
  assert.equal(hydrated.GST, '22AAAAA0000A1Z5');
  assert.equal(hydrated.TAN, 'ABCD12345E');
  assert.equal(hydrated.businessAddress, 'HQ Address');
  assert.equal(hydrated.contactPersonName, 'Jane');
  assert.equal(hydrated.clientFactSheet.description, 'Sensitive');
})();

console.log('clientProfileStorage.service.test.js passed');
