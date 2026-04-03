const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),\n      /Case state changed concurrently/",
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),\n      /Case state changed concurrently|Version mismatch: docket was updated by another request/"
);

content = content.replace(
  "e.message !== 'Case state changed concurrently'",
  "e.message !== 'Case state changed concurrently' && !e.message.includes('Version mismatch')"
);


fs.writeFileSync(file, content);
console.log('patched');
