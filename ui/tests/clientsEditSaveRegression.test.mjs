import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');

assert(
  source.includes("client?.clientId || client?.id || client?._id || ''"),
  'Edit client ID resolution should include _id fallback.',
);

assert(
  source.includes('if (selectedClient) {') && source.includes("if (!selectedClientId) throw new Error('This client record is missing an ID. Please refresh the page and try again.');"),
  'Edit mode should stay in update path and fail fast when identifier is missing.',
);

assert(
  source.includes("title={selectedClient ? `Edit Client • ${selectedClient.businessName || selectedClient.legalName || selectedClient.name || selectedClientId || 'Client'}` : 'Add New Client'}"),
  'Edit modal title should prefer readable business/client names before ID fallback.',
);

assert(
  source.includes('contactPersonEmailAddress: clientForm.contactPersonEmail')
    && source.includes('contactPersonPhoneNumber: clientForm.contactPersonPhone'),
  'Update payload should include legacy contact person keys for compatibility.',
);

assert(!source.includes('<form onSubmit={handleSaveClient} style='), 'Client form should not use inline layout style in edit/create modal form.');
assert(source.includes('className="client-form-grid"'), 'Client form should use class-based layout styling.');
assert(source.includes('className="client-modal-actions"'), 'Client modal actions should use reusable class-based styling.');

console.log('clientsEditSaveRegression.test.mjs passed');
