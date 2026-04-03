const fs = require('fs');

function fixDotenv(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.startsWith("require('dotenv').config();\n#!/usr/bin/env node")) {
    content = content.replace("require('dotenv').config();\n#!/usr/bin/env node", "#!/usr/bin/env node\nrequire('dotenv').config();");
    fs.writeFileSync(file, content);
  }
}

fixDotenv('tests/productionHardening.test.js');
console.log('fixed test files');
