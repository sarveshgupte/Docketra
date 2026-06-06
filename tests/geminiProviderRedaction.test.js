#!/usr/bin/env node
'use strict';

const assert = require('assert');
const geminiProvider = require('../src/services/ai/providers/gemini.provider');

async function withMockedFetch(run) {
  const originalFetch = global.fetch;
  try {
    await run();
  } finally {
    global.fetch = originalFetch;
  }
}

function assertDoesNotContainSensitiveValues(value, sensitiveValues) {
  const text = String(value || '');
  for (const sensitiveValue of sensitiveValues) {
    assert(
      !text.includes(sensitiveValue),
      `expected redacted text not to include sensitive value: ${sensitiveValue}`
    );
  }
}

async function testGeminiUsesHeaderAuthAndRedactsProviderErrors() {
  await withMockedFetch(async () => {
    const apiKey = 'AIzaSy-test-gemini-secret-key-123456';
    const promptText = 'PROMPT_TEXT_SHOULD_NOT_ESCAPE_TO_ERROR_DETAILS';
    const systemText = 'SYSTEM_TEXT_SHOULD_NOT_ESCAPE_TO_ERROR_DETAILS';
    const encodedApiKey = encodeURIComponent(apiKey);
    let capturedUrl;
    let capturedOptions;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return {
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          error: {
            message: `bad key ${apiKey} while handling ${promptText}`,
            debugUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodedApiKey}`,
            rawResponse: `upstream echoed ${systemText}`,
            details: [
              { metadata: { 'x-goog-api-key': apiKey } },
            ],
          },
        }),
      };
    };

    await assert.rejects(
      () => geminiProvider.generateChatResponse(promptText, systemText, {
        apiKey,
        model: 'gemini-2.5-flash',
      }),
      (error) => {
        assert.strictEqual(error.provider, 'gemini');
        assert.strictEqual(error.status, 403);
        assert.strictEqual(error.code, 'AI_INVALID_API_KEY');
        assertDoesNotContainSensitiveValues(error.message, [apiKey, promptText, systemText]);
        assertDoesNotContainSensitiveValues(error.details, [
          apiKey,
          encodedApiKey,
          promptText,
          systemText,
          `key=${encodedApiKey}`,
          `key=${apiKey}`,
        ]);
        assert(error.details.includes('[REDACTED_API_KEY]'), 'details should preserve sanitized diagnostic context');
        return true;
      }
    );

    assert.strictEqual(
      capturedUrl,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      'Gemini request URL must not include the API key'
    );
    assert(!capturedUrl.includes('?key='), 'Gemini request URL must not use query-string credentials');
    assert.strictEqual(capturedOptions.headers['x-goog-api-key'], apiKey);
    assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');
  });
}

async function testGenerateContentUrlDoesNotAppendKey() {
  const url = geminiProvider.buildGenerateContentUrl('gemini-2.5-flash');
  assert.strictEqual(
    url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  );
  assert(!url.includes('?key='), 'generated Gemini URL must never include a key query parameter');
}

(async function run() {
  await testGeminiUsesHeaderAuthAndRedactsProviderErrors();
  await testGenerateContentUrlDoesNotAppendKey();
  console.log('geminiProviderRedaction.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
