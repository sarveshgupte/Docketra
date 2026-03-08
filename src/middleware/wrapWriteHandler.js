const { executeWrite } = require('../utils/executeWrite');

/**
 * Wraps a write controller so that:
 *  1. The MongoDB session lifecycle is owned entirely by executeWrite.
 *  2. The controller runs inside withTransaction and can either send an HTTP
 *     response directly or return data for this wrapper to send.
 *  3. If a controller already sent the response (or returns undefined), the
 *     wrapper exits silently after a successful commit.
 *  4. Otherwise the HTTP response is sent AFTER the transaction commits.
 *  5. On error the transaction is aborted automatically and next(error) is
 *     called — no partial writes, no double-response.
 */
const wrapWriteHandler = (controllerFn) => {
  return async (req, res, next) => {
    try {
      if (req.transactionSession) {
        throw new Error('Nested transaction wrapper detected');
      }
      req._transactionResponse = res;
      const result = await executeWrite(req, async () => {
        return await controllerFn(req, res, next);
      });

      if (res.headersSent || typeof result === 'undefined') {
        return;
      }

      const hasExplicitStatusCode = result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'statusCode');
      const statusCode = hasExplicitStatusCode && Number.isInteger(result.statusCode) ? result.statusCode : 200;
      if (hasExplicitStatusCode) {
        const { statusCode: _statusCode, ...payload } = result;
        res.status(statusCode).json(payload);
      } else {
        res.status(statusCode).json(result);
      }
    } catch (error) {
      next(error);
    } finally {
      delete req._transactionResponse;
    }
  };
};

module.exports = wrapWriteHandler;
