const fs = require('fs');

function fixDotenv(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("require('dotenv').config()")) {
    content = "require('dotenv').config();\n" + content;
    fs.writeFileSync(file, content);
  }
}

fixDotenv('tests/productionHardening.test.js');
console.log('fixed test files');
