// Validate that required environment variables are set.
if (!process.env.SERP_API_KEY) {
    throw new Error('SERP_API_KEY environment variable not set.');
}
if (!process.env.HF_TOKEN) {
    throw new Error('HF_TOKEN environment variable not set.');
}

export const env = {
    SERP_API_KEY: process.env.SERP_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    useR0Llm: process.env.USE_R0_LLM?.toLowerCase() === 'true' || false,
    CACHE_TTL_HOURS: process.env.CACHE_TTL_HOURS
        ? parseInt(process.env.CACHE_TTL_HOURS, 10)
        : 24,
};
