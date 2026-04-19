import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const createDocketFormSource = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(createDocketFormSource.includes('useUnsavedChangesPrompt'), 'Create docket flow should use unsaved changes prompt');
assert.ok(createDocketFormSource.includes('setStatusMessage(\'Creating docket…\')'), 'Create docket flow should show an explicit saving state');
assert.ok(createDocketFormSource.includes('if (loading.submit) return;'), 'Create docket submit should block duplicate submissions');
assert.ok(createDocketFormSource.includes('setSubmitError('), 'Create docket flow should expose stable form-level error feedback');
assert.ok(createDocketFormSource.includes('onCancel?.();'), 'Create docket flow should support explicit cancel behavior');

const clientsPageSource = read('src/pages/ClientsPage.jsx');
assert.ok(clientsPageSource.includes('validateClientForm'), 'Client modal should include explicit validation');
assert.ok(clientsPageSource.includes('clientFormErrors'), 'Client modal should render field-level errors');
assert.ok(clientsPageSource.includes('onRequestClose={requestCloseClientModal}'), 'Client modal should protect dirty close via modal close paths');
assert.ok(clientsPageSource.includes('disabled={savingClient || !isClientFormDirty}'), 'Client save button should prevent duplicate or no-op submits');

const modalSource = read('src/components/common/Modal.jsx');
assert.ok(modalSource.includes('onRequestClose'), 'Modal should support request-close interception for dirty forms');
assert.ok(modalSource.includes("requestClose('escape')"), 'Modal should route Escape close through requestClose guard');
assert.ok(modalSource.includes("requestClose('overlay')"), 'Modal should route overlay close through requestClose guard');

console.log('formReliabilityHardening.test.mjs passed');
