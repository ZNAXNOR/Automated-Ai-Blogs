import { startFlowServer } from '@genkit-ai/express';
import { flows } from './src/flows';
import './src/prompts'

startFlowServer({
  flows,
});
