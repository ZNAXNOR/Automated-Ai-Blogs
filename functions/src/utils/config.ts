import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Validate that required environment variables are set.
if (!process.env.SERP_API_KEY) {
    throw new Error('SERP_API_KEY environment variable not set.');
}
if (!process.env.HF_TOKEN) {
    throw new Error('HF_TOKEN environment variable not set.');
}
if (!process.env.HF_API_KEY) {
    throw new Error('HF_API_KEY environment variable not set.');
}

// Export the configuration object.
export const env = {
    serpApiKey: process.env.SERP_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    HF_API_KEY: process.env.HF_API_KEY,
    useR0Llm: process.env.USE_R0_LLM === 'true',
    CACHE_TTL_HOURS: Number(process.env.CACHE_TTL_HOURS) || 24,
};