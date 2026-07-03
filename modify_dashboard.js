const fs = require('fs');
let code = fs.readFileSync('src/services/dashboard.service.js', 'utf8');

code = code.replace(
  /    blockedTaxonomyRaw,\n  \] = await Promise\.all\(\[/,
  '    blockedTaxonomyRaw,\n    stalePending,\n  ] = await Promise.all(['
);

fs.writeFileSync('src/services/dashboard.service.js', code);
