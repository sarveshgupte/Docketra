#!/usr/bin/env node
'use strict';

const assert = require('assert');
const openaiProvider = require('../src/services/ai/providers/openai.provider');

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

async function testOpenAiAnalyzeRedactsProviderErrors() {
  await withMockedFetch(async () => {
    const apiKey = 'sk-test-openai-secret-key-123456';
    const documentText = 'OPENAI_DOCUMENT_TEXT_SHOULD_NOT_ESCAPE_TO_ERROR_DETAILS';

    global.fetch = async (_url, options) => {
      assert.strictEqual(options.headers.Authorization, `Bearer ${apiKey}`);
      return {
        ok: false,
        status: 500,
        text: async () => JSON.stringify({
          error: {
            message: `provider echoed ${apiKey} and ${documentText}`,
            request: {
              authorization: `Bearer ${apiKey}`,
              body: JSON.parse(options.body),
            },
          },
        }),
      };
    };

    await assert.rejects(
      () => openaiProvider.analyze(documentText, { apiKey }),
      (error) => {
        assert.strictEqual(error.provider, 'openai');
        assert.strictEqual(error.status, 500);
        assert.strictEqual(error.code, 'AI_PROVIDER_REQUEST_FAILED');
        assertDoesNotContainSensitiveValues(error.message, [apiKey, documentText]);
        assertDoesNotContainSensitiveValues(error.details, [apiKey, documentText, `Bearer ${apiKey}`]);
        assert(error.details.includes('[REDACTED_API_KEY]'), 'details should preserve sanitized diagnostic context');
        return true;
      }
    );
  });
}

async function testOpenAiDocketGenerationRedactsProviderErrors() {
  await withMockedFetch(async () => {
    const apiKey = 'sk-test-openai-secret-key-abcdef';
    const docketInput = {
      title: 'OPENAI_DOCKET_TITLE_SHOULD_NOT_ESCAPE_TO_ERROR_DETAILS',
      clientId: 'client-123',
    };
    const inputText = JSON.stringify(docketInput);

    global.fetch = async (_url, options) => {
      assert.strictEqual(options.headers.Authorization, `Bearer ${apiKey}`);
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({
          error: {
            message: `invalid ${apiKey}`,
            rawRequestBody: JSON.parse(options.body),
            echoedInput: inputText,
          },
        }),
      };
    };

    await assert.rejects(
      () => openaiProvider.generateDocketFields(docketInput, { apiKey }),
      (error) => {
        assert.strictEqual(error.provider, 'openai');
        assert.strictEqual(error.status, 401);
        assert.strictEqual(error.code, 'AI_INVALID_API_KEY');
        assertDoesNotContainSensitiveValues(error.details, [
          apiKey,
          inputText,
          docketInput.title,
          `Bearer ${apiKey}`,
        ]);
        return true;
      }
    );
  });
}

(async function run() {
  await testOpenAiAnalyzeRedactsProviderErrors();
  await testOpenAiDocketGenerationRedactsProviderErrors();
  console.log('openaiProviderRedaction.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
