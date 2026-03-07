const crypto = require('crypto');

const hashIdentifier = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

module.exports = { hashIdentifier };
