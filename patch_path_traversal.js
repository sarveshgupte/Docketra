const fs = require('fs');

const targetFile = 'src/controllers/case.controller.js';
let content = fs.readFileSync(targetFile, 'utf8');

const pathCheckLogic = `
    if (!attachment.filePath) {
      return res.status(404).json({
        success: false,
        message: 'File location not found',
      });
    }

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

content = content.replace(`
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
`, pathCheckLogic);

fs.writeFileSync(targetFile, content);
console.log('Path traversal fix updated');
