const fs = require('fs');

const file = 'src/config/redis.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const getRedisClient = () => {",
  "const getRedisClient = () => { return null; "
);

fs.writeFileSync(file, content);
console.log('patched redis');
