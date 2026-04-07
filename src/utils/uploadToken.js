const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(6).toString('hex');
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

module.exports = { generateToken, generatePin };
