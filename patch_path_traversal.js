const fs = require('fs');

const targetFile = 'src/controllers/case.controller.js';
let content = fs.readFileSync(targetFile, 'utf8');

const pathCheckLogic = `
    const resolvedPath = path.resolve(attachment.filePath);
    const safeBaseDir = path.resolve(__dirname, '../../uploads');
    if (!resolvedPath.startsWith(safeBaseDir)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path',
      });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
`;

const pathCheckLogic2 = `
      // Legacy: Handle old attachments stored locally
      try {
        const resolvedPath = path.resolve(attachment.filePath);
        const safeBaseDir = path.resolve(__dirname, '../../uploads');
        if (!resolvedPath.startsWith(safeBaseDir)) {
          return res.status(403).json({
            success: false,
            message: 'Invalid file path',
          });
        }

        await fs.access(resolvedPath);
`;

content = content.replace(`    // Check if file exists
    try {
      await fs.access(attachment.filePath);`, pathCheckLogic);

content = content.replace(`      // Legacy: Handle old attachments stored locally
      try {
        await fs.access(attachment.filePath);`, pathCheckLogic2);

content = content.replace(`res.sendFile(path.resolve(attachment.filePath));`, `res.sendFile(resolvedPath);`);
content = content.replace(`res.sendFile(path.resolve(attachment.filePath));`, `res.sendFile(resolvedPath);`);

fs.writeFileSync(targetFile, content);
console.log('Path traversal fix applied');
