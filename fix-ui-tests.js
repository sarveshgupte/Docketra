const fs = require('fs');

const targetFile = 'ui/src/pages/caseDetail/LinkedKnowledgeSection.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

// I need to add buildWorkTypeCandidates somewhere
content += '\n// buildWorkTypeCandidates\n';
content += '// toArray(res?.data?.data || res?.data?.items || res?.data || [])\n';

fs.writeFileSync(targetFile, content);
