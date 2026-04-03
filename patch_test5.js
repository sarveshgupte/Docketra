const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "caseId: 'CASE-20260301-00002',\n        status: 'OPEN',",
  "caseId: 'CASE-20260301-00002',\n        status: 'OPEN',\n        docketState: 'IP',"
);

fs.writeFileSync(file, content);
console.log('patched');
