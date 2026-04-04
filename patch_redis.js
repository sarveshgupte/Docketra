const fs = require('fs');
let content = fs.readFileSync('src/config/redis.js', 'utf8');

if (!content.includes('process.env.NODE_ENV === \'test\'')) {
  content = content.replace('const initRedis = () => {', 'const initRedis = () => {\n  if (process.env.NODE_ENV === \'test\') return null;\n');
  fs.writeFileSync('src/config/redis.js', content);
}
