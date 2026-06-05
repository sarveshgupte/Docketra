const fs = require('fs');

const targetFile = 'DEPLOYMENT.md';
let content = fs.readFileSync(targetFile, 'utf8');

content = content.replace('file:///.github/workflows/deploy.yml', '.github/workflows/deploy.yml');
content = content.replace('file:///src/jobs/cloudRunJob.runner.js', 'src/jobs/cloudRunJob.runner.js');
content = content.replace('file:///src/jobs/cloudRunJob.runner.js', 'src/jobs/cloudRunJob.runner.js'); // just in case

fs.writeFileSync(targetFile, content);
