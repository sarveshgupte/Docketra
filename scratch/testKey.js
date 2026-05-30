'use strict';

require('dotenv').config();
const geminiProvider = require('../src/services/ai/providers/gemini.provider');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-3.5-flash';

  console.log('--- GEMINI API KEY DIAGNOSTICS ---');
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not defined in your .env file!');
    process.exit(1);
  }

  console.log(`Key Prefix: "${apiKey.slice(0, 7)}..."`);
  console.log(`Key Length: ${apiKey.length} characters`);
  console.log(`Testing Model: "${model}"`);

  console.log('\nSending test request to Google Gemini API...');
  try {
    const result = await geminiProvider.generateChatResponse(
      'Say hello and confirm you can read this message in one sentence.',
      null,
      { apiKey, model }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Gemini Response:', result.text);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILURE!');
    console.error('Error message:', error.message);
    if (error.status) console.error('HTTP Status:', error.status);
    if (error.details) console.error('Error details:', error.details);
    process.exit(1);
  }
})();
