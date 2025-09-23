import { z } from 'zod';
import { logger } from './logger';
import type { Response } from 'node-fetch';

/**
 * A wrapper for fetch responses that provides normalized .json() and .text() methods.
 */
export class ResponseWrapper {
    private constructor(private response: Response) {}

    static create(response: Response): ResponseWrapper {
        return new ResponseWrapper(response);
    }

    async json<T>(schema: z.ZodType<T>): Promise<T> {
        const text = await this.response.text();
        try {
            // Extract JSON from markdown code blocks
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.substring(7);
            }
            if (jsonText.endsWith('```')) {
                jsonText = jsonText.slice(0, -3);
            }

            let data = JSON.parse(jsonText);
            // Handle double-stringified JSON
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const validatedData = schema.parse(data);
            return validatedData;
        } catch (error) {
            logger.error('ResponseWrapper.json: Validation failed', { error, text });
            throw error;
        }
    }

    async text(): Promise<string> {
        return this.response.text();
    }
}
