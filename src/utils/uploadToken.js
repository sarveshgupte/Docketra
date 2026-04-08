const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(6).toString('hex');
}

function generatePin() {
  return crypto.randomInt(1000, 10000).toString();
}

module.exports = { generateToken, generatePin };
