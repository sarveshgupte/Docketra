'use strict';

const log = require('../../../utils/log');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REDACTED_API_KEY = '[REDACTED_API_KEY]';
const REDACTED_PROMPT = '[REDACTED_PROMPT]';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactExactValue(text, value, replacement) {
  if (!value || typeof value !== 'string') {
    return text;
  }
  return text.replace(new RegExp(escapeRegExp(value), 'g'), replacement);
}

function redactProviderErrorBody(body, sensitiveValues = {}) {
  let safeBody = typeof body === 'string' ? body : JSON.stringify(body || {});

  safeBody = safeBody
    .replace(/([?&](?:key|api_key|apiKey)=)[^&\s"'<>]+/gi, `$1${REDACTED_API_KEY}`)
    .replace(/("(?:key|api_key|apiKey)"\s*:\s*")[^"]+/gi, `$1${REDACTED_API_KEY}`)
    .replace(/((?:x-goog-api-key|authorization)\s*[:=]\s*)[^\s"',}]+/gi, `$1${REDACTED_API_KEY}`);

  const apiKey = sensitiveValues.apiKey;
  safeBody = redactExactValue(safeBody, apiKey, REDACTED_API_KEY);
  if (apiKey) {
    safeBody = redactExactValue(safeBody, encodeURIComponent(apiKey), REDACTED_API_KEY);
  }

  safeBody = redactExactValue(safeBody, sensitiveValues.message, REDACTED_PROMPT);
  safeBody = redactExactValue(safeBody, sensitiveValues.systemInstruction, REDACTED_PROMPT);

  return safeBody.slice(0, 250);
}

function buildGenerateContentUrl(model) {
  const modelPath = String(model)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${GEMINI_API_BASE_URL}/${modelPath}:generateContent`;
}

function notImplementedError() {
  const error = new Error('Gemini provider is not implemented');
  error.code = 'AI_PROVIDER_NOT_CONFIGURED';
  return error;
}

async function analyze() {
  throw notImplementedError();
}

async function generateDocketFields() {
  throw notImplementedError();
}

/**
 * Generate chat completion response using Gemini API REST endpoint.
 * Suitable for free tier (gemini-1.5-flash) and other Gemini models.
 * 
 * @param {string} message - User message
 * @param {string} systemInstruction - System instruction/context for the advisor mode
 * @param {object} options - Generation options (apiKey, model, temperature, etc.)
 */
async function generateChatResponse(message, systemInstruction, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = options.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = buildGenerateContentUrl(model);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: message,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxOutputTokens || 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Gemini request failed with status ${response.status}`);
    error.status = response.status;
    error.provider = 'gemini';
    error.code = response.status === 401 || response.status === 403
      ? 'AI_INVALID_API_KEY'
      : 'AI_PROVIDER_REQUEST_FAILED';
    error.details = redactProviderErrorBody(body, {
      apiKey,
      message,
      systemInstruction,
    });
    throw error;
  }

  const payload = await response.json();
  const textResponse = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    log.error('[GEMINI] Response structure mismatch:', {
      model,
      candidateCount: Array.isArray(payload?.candidates) ? payload.candidates.length : 0,
      hasPromptFeedback: Boolean(payload?.promptFeedback),
    });
    const error = new Error('Gemini response missing text content');
    error.provider = 'gemini';
    error.code = 'AI_PROVIDER_RESPONSE_MALFORMED';
    throw error;
  }

  return {
    text: textResponse,
    model,
    _providerMeta: {
      candidates: payload?.candidates,
      promptFeedback: payload?.promptFeedback,
    },
  };
}

module.exports = {
  analyze,
  generateDocketFields,
  generateChatResponse,
  redactProviderErrorBody,
  buildGenerateContentUrl,
};
