const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "await CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, metadata: { reason: 'test' } });",
  "await CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' });"
);

content = content.replace(
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, metadata: { reason: 'test' } }),",
  "() => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),"
);

fs.writeFileSync(file, content);
console.log('patched');
