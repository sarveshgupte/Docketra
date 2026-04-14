'use strict';

const openAiProvider = require('./providers/openai.provider');

const providers = {
  openai: openAiProvider,
};

async function analyzeDocument(text, firmId) {
  const providerName = String(process.env.AI_PROVIDER || 'openai').toLowerCase();
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported AI provider: ${providerName}`);
  }
  return provider.analyze(text, { firmId });
}

module.exports = {
  analyzeDocument,
};
