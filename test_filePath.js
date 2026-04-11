const path = require('path');
const attachment = { filePath: null };
const resolvedPath = path.resolve(attachment.filePath || '');
const safeBaseDir = path.resolve(__dirname, '../../uploads');
console.log(resolvedPath);
console.log(safeBaseDir);
console.log(resolvedPath.startsWith(safeBaseDir));
