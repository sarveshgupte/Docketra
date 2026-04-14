'use strict';

const Firm = require('../models/Firm.model');
const { encrypt } = require('../utils/encryption');

const ALLOWED_PROVIDERS = new Set(['openai', 'gemini', 'claude']);

function isValidApiKeyForProvider(provider, apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) return false;

  if (provider === 'openai') {
    return /^sk-[A-Za-z0-9._-]{10,}$/.test(value);
  }

  if (provider === 'gemini') {
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(value) || value.length >= 20;
  }

  if (provider === 'claude') {
    return /^sk-ant-[A-Za-z0-9_-]{10,}$/.test(value) || value.length >= 20;
  }

  return value.length >= 20;
}

async function setAiConfig(req, res) {
  const provider = String(req.body?.provider || '').trim().toLowerCase();
  const apiKey = String(req.body?.apiKey || '').trim();
  const model = String(req.body?.model || '').trim();

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported AI provider' });
  }

  if (!isValidApiKeyForProvider(provider, apiKey)) {
    return res.status(400).json({ success: false, message: 'Invalid API key format' });
  }

  await Firm.findByIdAndUpdate(
    req.firmId,
    {
      $set: {
        'aiConfig.provider': provider,
        'aiConfig.apiKey': encrypt(apiKey),
        'aiConfig.model': model || null,
      },
    },
    { new: true, runValidators: true }
  );

  return res.json({
    success: true,
    connected: true,
    provider,
    model: model || null,
  });
}

async function getAiConfigStatus(req, res) {
  const firm = await Firm.findById(req.firmId).select('aiConfig').lean();
  const provider = firm?.aiConfig?.provider || 'openai';
  const model = firm?.aiConfig?.model || null;
  const connected = Boolean(firm?.aiConfig?.apiKey);

  return res.json({
    connected,
    provider,
    model,
  });
}

async function removeAiConfig(req, res) {
  await Firm.findByIdAndUpdate(req.firmId, {
    $unset: {
      'aiConfig.apiKey': '',
      'aiConfig.model': '',
    },
    $set: {
      'aiConfig.provider': 'openai',
    },
  });

  return res.json({ success: true, connected: false });
}

module.exports = {
  setAiConfig,
  getAiConfigStatus,
  removeAiConfig,
};
