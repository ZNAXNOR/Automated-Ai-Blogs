import { hfComplete } from '../../../clients/hf';
import { env } from '../../../utils/config';
import { HttpsError } from 'firebase-functions/v2/https';

describe('Hugging Face Integration Test', () => {
  jest.setTimeout(30000); // Set timeout for all tests in this suite

  if (env.hfToken) {
    it('should get a valid response from a different Hugging Face model', async () => {
      const model = 'gpt2'; // Using a smaller, more common model
      const prompt = 'Hello, world!';

      try {
        const response = await hfComplete(prompt, model);
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
      } catch (error) {
        if (error instanceof HttpsError) {
          console.error('Hugging Face API Error:', error.message);
        }
        throw error;
      }
    });
  }
});
