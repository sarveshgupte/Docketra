const fs = require('fs');
const files = ['tests/securityHardening.test.js', 'tests/coreSecurityHardeningPhase2.test.js'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("require('dotenv').config()")) {
    content = "require('dotenv').config();\n" + content;
    fs.writeFileSync(file, content);
  }
});
console.log('patched test files with dotenv config');
