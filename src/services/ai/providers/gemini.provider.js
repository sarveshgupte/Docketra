'use strict';

const log = require('../../../utils/log');

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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Gemini request failed with status ${response.status}`);
    error.status = response.status;
    error.provider = 'gemini';
    error.details = body.slice(0, 250);
    throw error;
  }

  const payload = await response.json();
  const textResponse = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    log.error('[GEMINI] Response structure mismatch:', { payload });
    throw new Error('Gemini response missing text content');
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
};
