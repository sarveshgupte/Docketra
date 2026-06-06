'use strict';

const OPENAI_ENDPOINT = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const REDACTED_API_KEY = '[REDACTED_API_KEY]';
const REDACTED_PROMPT = '[REDACTED_PROMPT]';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeStringify(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value || {});
  } catch (_error) {
    return '';
  }
}

function redactExactValue(text, value, replacement) {
  if (!value || typeof value !== 'string') {
    return text;
  }
  return text.replace(new RegExp(escapeRegExp(value), 'g'), replacement);
}

function collectStringValues(value, output = [], seen = new Set()) {
  if (output.length >= 25 || value == null) {
    return output;
  }

  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (typeof value !== 'object' || seen.has(value)) {
    return output;
  }

  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, output, seen);
    }
    return output;
  }

  for (const item of Object.values(value)) {
    collectStringValues(item, output, seen);
  }
  return output;
}

function redactProviderErrorBody(body, sensitiveValues = {}) {
  let safeBody = safeStringify(body)
    .replace(/([?&](?:key|api_key|apiKey)=)[^&\s"'<>]+/gi, `$1${REDACTED_API_KEY}`)
    .replace(/("(?:key|api_key|apiKey)"\s*:\s*")[^"]+/gi, `$1${REDACTED_API_KEY}`)
    .replace(/((?:authorization|bearer)\s*[:=]\s*)[^\s"',}]+/gi, `$1${REDACTED_API_KEY}`);

  const apiKey = sensitiveValues.apiKey;
  safeBody = redactExactValue(safeBody, apiKey, REDACTED_API_KEY);
  if (apiKey) {
    safeBody = redactExactValue(safeBody, encodeURIComponent(apiKey), REDACTED_API_KEY);
  }

  for (const sensitiveValue of sensitiveValues.prompts || []) {
    safeBody = redactExactValue(safeBody, sensitiveValue, REDACTED_PROMPT);
    if (sensitiveValue) {
      safeBody = redactExactValue(safeBody, encodeURIComponent(sensitiveValue), REDACTED_PROMPT);
    }
  }

  return safeBody.slice(0, 250);
}

async function analyze(text, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for document analysis');
  }

  const prompt = {
    text,
    instruction: 'Classify document type, extract key fields, suggest department',
  };

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Return strict JSON with keys: documentType, extractedFields, suggestedTeam, tags, confidence. No markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify(prompt),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`OpenAI request failed (${response.status})`);
    if (response.status === 401) {
      error.code = 'AI_INVALID_API_KEY';
    } else {
      error.code = 'AI_PROVIDER_REQUEST_FAILED';
    }
    error.status = response.status;
    error.provider = 'openai';
    error.details = redactProviderErrorBody(body, {
      apiKey,
      prompts: [text, JSON.stringify(prompt)],
    });
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response missing content');
  }

  const parsed = JSON.parse(content);
  return {
    documentType: parsed.documentType || 'Unknown',
    extractedFields: parsed.extractedFields || {},
    suggestedTeam: parsed.suggestedTeam || 'Legal',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
    confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : 0,
    _providerMeta: {
      providerRequestId: payload?.id || null,
      tokenUsage: {
        inputTokens: Number(payload?.usage?.prompt_tokens || 0),
        outputTokens: Number(payload?.usage?.completion_tokens || 0),
        totalTokens: Number(payload?.usage?.total_tokens || 0),
      },
    },
  };
}

async function generateDocketFields(input, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for docket field generation');
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Return JSON only.',
            'Select ONLY ids from provided clients/categories/subCategories.',
            'Do not invent new ids, names, or values.',
            'If uncertain for any selection, return null for that field.',
            'Return exactly these keys:',
            'clientId, categoryId, subCategoryId, title, description, confidence.',
            'confidence must be a number between 0 and 1.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`OpenAI request failed (${response.status})`);
    if (response.status === 401) {
      error.code = 'AI_INVALID_API_KEY';
    } else {
      error.code = 'AI_PROVIDER_REQUEST_FAILED';
    }
    error.status = response.status;
    error.provider = 'openai';
    error.details = redactProviderErrorBody(body, {
      apiKey,
      prompts: [safeStringify(input), ...collectStringValues(input)],
    });
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response missing content');
  }

  const parsed = JSON.parse(content);
  return {
    clientId: parsed?.clientId || null,
    categoryId: parsed?.categoryId || null,
    subCategoryId: parsed?.subCategoryId || null,
    title: String(parsed?.title || '').trim(),
    description: String(parsed?.description || '').trim(),
    confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : 0,
    _providerMeta: {
      providerRequestId: payload?.id || null,
      tokenUsage: {
        inputTokens: Number(payload?.usage?.prompt_tokens || 0),
        outputTokens: Number(payload?.usage?.completion_tokens || 0),
        totalTokens: Number(payload?.usage?.total_tokens || 0),
      },
    },
  };
}

module.exports = {
  analyze,
  generateDocketFields,
  redactProviderErrorBody,
};
