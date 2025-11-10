import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

enableFirebaseTelemetry();

export const ai = genkit({
  plugins: [googleAI()],
});

export const model = googleAI.model('gemini-2.0-flash');
