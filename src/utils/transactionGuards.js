const { executeWrite } = require('./executeWrite');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');

const guardTransaction = (req) => {
  if (req?.skipTransaction) {
    return;
  }
  if (!req || !req.transactionActive) {
    const err = new Error('Write attempted without active transaction');
    err.statusCode = 500;
    throw err;
  }
};

module.exports = {
  guardTransaction,
  wrapWriteHandler,
};
