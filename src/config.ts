import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

export const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_ALLOWED_USER_IDS: (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id)),
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    XAI_API_KEY: process.env.XAI_API_KEY || '',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/free',
    DB_PATH: process.env.DB_PATH || './memory.db',
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json'
};

// Validate critical config
if (!config.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in environment variables.');
}
if (!config.GROQ_API_KEY && !config.OPENROUTER_API_KEY) {
    throw new Error('At least one of GROQ_API_KEY or OPENROUTER_API_KEY must be provided.');
}
if (config.TELEGRAM_ALLOWED_USER_IDS.length === 0) {
    console.warn('WARNING: TELEGRAM_ALLOWED_USER_IDS is empty. Bot will not respond to anyone.');
}
