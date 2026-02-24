const { executeWrite } = require('../utils/executeWrite');

/**
 * Wraps a write controller so that:
 *  1. The MongoDB session lifecycle is owned entirely by executeWrite.
 *  2. The controller runs inside withTransaction and returns data instead of
 *     sending an HTTP response.
 *  3. The HTTP response is sent AFTER the transaction successfully commits.
 *  4. On error the transaction is aborted automatically and next(error) is
 *     called — no partial writes, no double-response.
 */
const wrapWriteHandler = (controllerFn) => {
  return async (req, res, next) => {
    try {
      if (req.transactionSession) {
        throw new Error('Nested transaction wrapper detected');
      }
      const result = await executeWrite(req, async (session) => {
        req.transactionSession = { session };
        return await controllerFn(req, res, next);
      });

      if (!res.headersSent) {
        res.status(201).json(result);
      }
    } catch (error) {
      next(error);
    } finally {
      delete req.transactionSession;
    }
  };
};

module.exports = wrapWriteHandler;
