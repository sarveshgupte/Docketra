import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const clientsPage = fs.readFileSync(path.join(root, 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');
const clientApi = fs.readFileSync(path.join(root, 'ui', 'src', 'api', 'client.api.js'), 'utf8');
const clientRoutesSchema = fs.readFileSync(path.join(root, 'src', 'schemas', 'client.routes.schema.js'), 'utf8');

// 1. Verify UI contains the "Auto-fill from CIN" button
assert(clientsPage.includes("'Auto-fill from CIN'"), 'ClientsPage must contain the "Auto-fill from CIN" action button');

// 2. Verify UI contains the MCA21 quick-intake card
assert(clientsPage.includes('MCA21 Regulatory Quick-Fill'), 'ClientsPage must contain MCA21 quick-intake card');

// 3. Verify handleMcaLookup invokes clientApi.lookupMca
assert(clientsPage.includes('clientApi.lookupMca(payload)'), 'ClientsPage must call clientApi.lookupMca');

// 4. Verify client form auto-population from MCA data
assert(clientsPage.includes('businessName: d.businessName'), 'ClientsPage must map businessName from MCA response');
assert(clientsPage.includes('businessAddress: d.registeredAddress'), 'ClientsPage must map businessAddress from MCA response');
assert(clientsPage.includes('city: d.city'), 'ClientsPage must map city from MCA response');
assert(clientsPage.includes('state: d.state'), 'ClientsPage must map state from MCA response');
assert(clientsPage.includes('pincode: d.pincode'), 'ClientsPage must map pincode from MCA response');
assert(clientsPage.includes('CIN: d.cin'), 'ClientsPage must map CIN from MCA response');
assert(clientsPage.includes('PAN: d.pan'), 'ClientsPage must map PAN from MCA response');

// 5. Verify mcaDossier is preserved and persisted on creation & update
assert(clientsPage.includes('...(mcaDossier ? { mcaDossier } : {})'), 'ClientsPage must persist mcaDossier in client payloads');

// 6. Verify clientApi exports lookupMca
assert(clientApi.includes("lookupMca: ({ cin, pan }) => request((http) => http.post('/clients/mca/lookup'"), 'clientApi must export lookupMca calling /clients/mca/lookup');

// 7. Verify route schema validates POST /mca/lookup
assert(clientRoutesSchema.includes("'POST /mca/lookup'"), 'client.routes.schema must define schema for POST /mca/lookup');

console.log('✓ mcaAutoFillModal.test.mjs passed successfully!');
