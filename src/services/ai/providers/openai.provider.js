'use strict';

const OPENAI_ENDPOINT = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
    }
    error.status = response.status;
    error.provider = 'openai';
    error.details = body.slice(0, 250);
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
    }
    error.status = response.status;
    error.provider = 'openai';
    error.details = body.slice(0, 250);
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
};
