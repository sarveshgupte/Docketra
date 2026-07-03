const fs = require('fs');
let code = fs.readFileSync('src/services/dashboard.service.js', 'utf8');

code = code.replace(
  /  const \[items, total\] = stalePending,\n  \] = await Promise\.all\(\[/,
  '  const [items, total] = await Promise.all(['
);

fs.writeFileSync('src/services/dashboard.service.js', code);
