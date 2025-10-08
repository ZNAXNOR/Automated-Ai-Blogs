import { startFlowServer } from '@genkit-ai/express';
import { flows } from './src/flows';
import './prompts'

startFlowServer({
  flows,
});
