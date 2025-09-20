import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// --- Environment Validation ---
const requiredEnvVars = [
    'SERPAPI_KEY',
    'HF_TOKEN',
    'WP_API_URL',
    'WP_USERNAME',
    'WP_PASSWORD'
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// --- Format Validation ---
try {
    new URL(process.env.WP_API_URL!);
} catch (e) {
    throw new Error('WP_API_URL is not a valid URL.');
}

if (process.env.CACHE_TTL_HOURS) {
    const ttl = Number(process.env.CACHE_TTL_HOURS);
    if (isNaN(ttl) || ttl <= 0) {
        throw new Error('CACHE_TTL_HOURS must be a positive number.');
    }
}

// --- Exported Configuration ---
export const env = {
    // API Keys
    serpApiKey: process.env.SERPAPI_KEY!,
    hfToken: process.env.HF_TOKEN!,

    // WordPress
    wpApiUrl: process.env.WP_API_URL!,
    wpUsername: process.env.WP_USERNAME!,
    wpPassword: process.env.WP_PASSWORD!,

    // Feature Flags & Settings
    useR0Llm: process.env.USE_R0_LLM === 'true',
    CACHE_TTL_HOURS: Number(process.env.CACHE_TTL_HOURS) || 24,

    // Model Slugs 
    hfModelR1: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    hfModelR2: 'microsoft/Phi-3-mini-4k-instruct',
    hfModelR3: 'mistralai/Mistral-7B-Instruct-v0.2',
    hfModelR4: 'mistralai/Mistral-7B-Instruct-v0.2',
    hfModelR5: 'google/gemma-2-7b-it',
    hfModelR6: 'sentence-transformers/all-MiniLM-L6-v2',
};
