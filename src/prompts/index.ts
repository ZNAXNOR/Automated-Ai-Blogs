// Ensure every prompt file is imported so its registration runs
import './r1_ideate.prompt';
import './r1_ideate_with_search.prompt'
import './r2_angle.prompt';
import './r3_draft.prompt';
import './r4_polish.prompt';
import './r5_meta.prompt';
import './r6_coherence.prompt';

// Optionally export prompt references
export { ideationPrompt } from './r1_ideate.prompt';
export { ideationPromptWithSearch } from './r1_ideate_with_search.prompt';
export { outlinePrompt } from './r2_angle.prompt';
export { draftPrompt } from './r3_draft.prompt';
export { polishPrompt } from './r4_polish.prompt';
export { metaPrompt } from './r5_meta.prompt';
export { coherencePrompt } from './r6_coherence.prompt';

console.log('[DotPrompt]      All prompt modules registered');
