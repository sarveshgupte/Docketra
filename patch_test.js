const fs = require('fs');
const file = 'tests/caseSlaConcurrency.test.js';
let content = fs.readFileSync(file, 'utf8');

// Replace Case.findOne mock to support lean()
content = content.replace(
  "Case.findOne = async () => ({",
  "Case.findOne = () => ({\n      lean: async () => ({ \n        caseId: 'CASE-20260301-00002',\n        status: 'OPEN',\n        tatPaused: false,\n        tatLastStartedAt: fixedStart,\n        tatAccumulatedMinutes: 0,\n        firmId: 'firm-a',\n      })\n    });\n    // old findOne start: Case.findOne = async () => ({"
);

fs.writeFileSync(file, content);
console.log('patched');
