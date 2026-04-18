'use strict';

function notImplementedError() {
  const error = new Error('Claude provider is not implemented');
  error.code = 'AI_PROVIDER_NOT_CONFIGURED';
  return error;
}

async function analyze() {
  throw notImplementedError();
}

async function generateDocketFields() {
  throw notImplementedError();
}

module.exports = {
  analyze,
  generateDocketFields,
};
