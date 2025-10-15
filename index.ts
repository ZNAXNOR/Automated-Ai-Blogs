import { startFlowServer } from '@genkit-ai/express';
import { flows } from './src/flows';
import './src/prompts'
import './src/tools'
import './src/schemas'

startFlowServer({
  flows,
});
