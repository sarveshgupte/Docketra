const fs = require('fs');

const file = 'tests/productionHardening.test.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "require('bcrypt')",
  "require('crypto')"
);

content = content.replace(
  "const bcrypt = require('bcrypt');",
  "// const bcrypt = require('bcrypt');"
);


// There's a patchedLoad in productionHardening.test.js that might be intercepting requires. Let's just fix bcrypt issue.
