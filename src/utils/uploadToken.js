const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(6).toString('hex');
}

function generatePin() {
  // SEC-FIX: Replaced Math.random with cryptographically secure crypto.randomInt
  return crypto.randomInt(1000, 10000).toString();
}

module.exports = { generateToken, generatePin };
