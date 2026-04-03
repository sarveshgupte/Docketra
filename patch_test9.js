const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const DocketAudit = require('../src/models/DocketAudit.model');",
  "const DocketAudit = require('../src/models/DocketAuditLog.model');"
);

fs.writeFileSync(file, content);
console.log('patched');
