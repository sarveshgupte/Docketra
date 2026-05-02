const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

(function run() {
  const crmApi = read('ui/src/api/crm.api.js');
  assert(crmApi.includes("http.get('/crm/clients'"), 'crmApi.listClients must call /crm/clients');
  assert(crmApi.includes("http.get(`/crm/clients/${id}`)"), 'crmApi.getClientById must call /crm/clients/:id');

  const formsApi = read('ui/src/api/forms.api.js');
  assert(formsApi.includes("http.get('/forms')"), 'formsApi.listForms must call /forms');

  const reportsService = read('ui/src/services/reports.service.js');
  assert(reportsService.includes("api.get('/reports/case-metrics'"), 'reportsService must call /reports/case-metrics');

  const storageService = read('ui/src/services/storageService.js');
  assert(storageService.includes("api.get('/storage/configuration'"), 'storageService must call /storage/configuration');

  const aiService = read('ui/src/services/aiService.js');
  assert(aiService.includes("api.get('/ai/configuration'"), 'aiService must call /ai/configuration');

  const tenantMount = read('src/app/routes/mountTenantRoutes.js');
  const requiredMounts = [
    "app.use('/api/clients'",
    "app.use('/api/leads'",
    "app.use('/api/forms'",
    "app.use('/api/reports'",
    "app.use('/api/storage'",
    "app.use('/api/ai'",
    "app.use('/api/crm/clients'",
  ];
  requiredMounts.forEach((mount) => {
    assert(tenantMount.includes(mount), `Missing tenant route mount: ${mount}`);
  });

  console.log('primaryAdminSidebarApiContracts.test.js passed');
})();
