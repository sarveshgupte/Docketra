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
          content: 'Return strict JSON with keys: documentType, extractedFields, suggestedTeam, tags. No markdown.',
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
  };
}

module.exports = {
  analyze,
};
