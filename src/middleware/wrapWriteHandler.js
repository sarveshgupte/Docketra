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
    let sessionAttached = false;
    try {
      if (req.transactionSession) {
        throw new Error('Nested transaction wrapper detected');
      }
      const result = await executeWrite(req, async (session) => {
        req.transactionSession = { session };
        sessionAttached = true;
        return await controllerFn(req, res, next);
      });

      if (!res.headersSent) {
        const hasExplicitStatusCode = !!(result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'statusCode'));
        const statusCode = hasExplicitStatusCode && Number.isInteger(result.statusCode) ? result.statusCode : 201;
        if (hasExplicitStatusCode) {
          const { statusCode: _statusCode, ...payload } = result;
          res.status(statusCode).json(payload);
        } else {
          res.status(statusCode).json(result);
        }
      }
    } catch (error) {
      next(error);
    } finally {
      if (sessionAttached) {
        delete req.transactionSession;
      }
    }
  };
};

module.exports = wrapWriteHandler;
