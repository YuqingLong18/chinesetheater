import { env } from './config/env.js';

console.log('OpenRouter Configuration Check:');
console.log('================================');

const apiKey = env.OPENROUTER_API_KEY;

if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY is not set');
    process.exit(1);
}

if (apiKey === 'sk-or-v1-your-openrouter-api-key-here') {
    console.error('❌ OPENROUTER_API_KEY is still set to the placeholder value');
    console.error('   Please update it in your .env file with a real API key from https://openrouter.ai/keys');
    process.exit(1);
}

if (!apiKey.startsWith('sk-or-v1-')) {
    console.warn('⚠️  OPENROUTER_API_KEY does not start with "sk-or-v1-"');
    console.warn('   This might not be a valid OpenRouter API key format');
}

console.log(`✅ OPENROUTER_API_KEY is set (${apiKey.substring(0, 12)}...)`);
console.log(`✅ Chat Model: ${env.OPENROUTER_CHAT_MODEL}`);
console.log(`✅ Image Model: ${env.OPENROUTER_IMAGE_MODEL}`);
console.log('');
console.log('If you are still getting 401 errors, your API key may be invalid or expired.');
console.log('Please verify it at: https://openrouter.ai/keys');
