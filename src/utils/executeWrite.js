/**
 * Execute a mutating handler inside an active transaction session.
 * Throws when no transaction was established by upstream middleware.
 */
const executeWrite = async ({ req, fn }) => {
  if (!req || !req.transactionActive || !req.transactionSession?.withTransaction) {
    const error = new Error('Mutation attempted without active transaction');
    error.statusCode = 500;
    throw error;
  }

  req.transactionCommitted = false;

  const result = await req.transactionSession.withTransaction(async () => fn(req.transactionSession.session));
  req.transactionCommitted = true;
  return result;
};

module.exports = { executeWrite };
