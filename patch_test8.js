const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const CaseAudit = require('../src/models/CaseAudit.model');",
  "const CaseAudit = require('../src/models/CaseAudit.model');\nconst DocketAudit = require('../src/models/DocketAudit.model');"
);

content = content.replace(
  "CaseAudit.create = async () => ({});",
  "CaseAudit.create = async () => ({});\n    DocketAudit.create = async () => ({});"
);

content = content.replace(
  "CaseAudit.create = originalCaseAuditCreate;",
  "CaseAudit.create = originalCaseAuditCreate;\n    DocketAudit.create = undefined;"
);

fs.writeFileSync(file, content);
console.log('patched');
