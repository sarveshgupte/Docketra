'use strict';

const Firm = require('../../models/Firm.model');
const { decrypt } = require('../../utils/encryption');
const openAiProvider = require('./providers/openai.provider');
const geminiProvider = require('./providers/gemini.provider');
const claudeProvider = require('./providers/claude.provider');

const providers = {
  openai: openAiProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
};

function resolveSystemApiKey(providerName) {
  if (providerName === 'gemini') return process.env.GEMINI_API_KEY || null;
  if (providerName === 'claude') return process.env.CLAUDE_API_KEY || null;
  return process.env.OPENAI_API_KEY || null;
}

function resolveSystemModel(providerName) {
  if (providerName === 'gemini') return process.env.GEMINI_MODEL || null;
  if (providerName === 'claude') return process.env.CLAUDE_MODEL || null;
  return process.env.OPENAI_MODEL || null;
}

async function analyzeDocument(text, firmId) {
  const isAiEnabled = String(process.env.ENABLE_AI_ANALYSIS || 'false').toLowerCase() === 'true';
  if (!isAiEnabled) {
    throw new Error('AI_ANALYSIS_DISABLED');
  }

  const firm = await Firm.findById(firmId).select('aiConfig').lean();
  const firmProvider = String(firm?.aiConfig?.provider || '').trim().toLowerCase();
  const providerName = firmProvider || String(process.env.AI_PROVIDER || 'openai').toLowerCase();
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported AI provider: ${providerName}`);
  }

  const encryptedApiKey = firm?.aiConfig?.apiKey || null;
  const apiKey = encryptedApiKey ? decrypt(encryptedApiKey) : resolveSystemApiKey(providerName);
  const model = String(firm?.aiConfig?.model || '').trim() || resolveSystemModel(providerName);

  if (!apiKey) {
    throw new Error('AI_API_KEY_NOT_CONFIGURED');
  }

  return provider.analyze(text, { apiKey, model, firmId });
}

async function generateDocketFields(input, firmId) {
  const isAiEnabled = String(process.env.ENABLE_AI_DOCKET_CREATION || 'true').toLowerCase() === 'true';
  if (!isAiEnabled) {
    throw new Error('AI_DOCKET_CREATION_DISABLED');
  }

  const firm = await Firm.findById(firmId).select('aiConfig').lean();
  const firmProvider = String(firm?.aiConfig?.provider || '').trim().toLowerCase();
  const providerName = firmProvider || String(process.env.AI_PROVIDER || 'openai').toLowerCase();
  const provider = providers[providerName];
  if (!provider || typeof provider.generateDocketFields !== 'function') {
    throw new Error(`Unsupported AI provider for docket generation: ${providerName}`);
  }

  const encryptedApiKey = firm?.aiConfig?.apiKey || null;
  const apiKey = encryptedApiKey ? decrypt(encryptedApiKey) : resolveSystemApiKey(providerName);
  const model = String(firm?.aiConfig?.model || '').trim() || resolveSystemModel(providerName);

  if (!apiKey) {
    throw new Error('AI_API_KEY_NOT_CONFIGURED');
  }

  return provider.generateDocketFields(input, { apiKey, model, firmId });
}

module.exports = {
  analyzeDocument,
  generateDocketFields,
};
