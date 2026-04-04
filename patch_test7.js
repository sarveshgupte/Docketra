const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "status: 'OPEN',\n        docketState: 'PENDING',",
  "status: 'IN_PROGRESS',\n        docketState: 'IN_PROGRESS',"
);

content = content.replace(
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),\n      /Invalid docket state transition|Case state changed concurrently/",
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),\n      /Case state changed concurrently/"
);

fs.writeFileSync(file, content);
console.log('patched');
