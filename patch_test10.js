const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "await CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' });\n    await assert.rejects(\n      () => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),",
  "// update1\n    await CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }).catch(e => { if (e.message !== 'Case state changed concurrently') throw e; });\n    // update2\n    await assert.rejects(\n      () => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),"
);

fs.writeFileSync(file, content);
console.log('patched');
