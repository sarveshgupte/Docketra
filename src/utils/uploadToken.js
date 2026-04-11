const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(6).toString('hex');
}

function generatePin() {
  let num;
  do {
    num = crypto.randomBytes(2).readUInt16BE(0);
  } while (num >= 63000); // 9000 * 7 = 63000, reject to avoid modulo bias
  return (1000 + (num % 9000)).toString();
}

module.exports = { generateToken, generatePin };
