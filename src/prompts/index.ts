// Ensure every prompt file is imported so its registration runs
import './r1_ideate.prompt';
import './r1_ideate_with_search.prompt'
import './r2_angle.prompt';
import './r3_draft_section.prompt';
import './r3_draft.prompt';
import './r4_polish.prompt';
import './r5_meta.prompt';
import './r6_coherence.prompt';

import './tools/urlContext.prompt'

// Optionally export prompt references
export { ideationPrompt } from './r1_ideate.prompt';
export { ideationPromptWithSearch } from './r1_ideate_with_search.prompt';
export { anglePrompt } from './r2_angle.prompt';
export { draftSectionPrompt } from './r3_draft_section.prompt';
export { draftPrompt } from './r3_draft.prompt';
export { polishPrompt } from './r4_polish.prompt';
export { metaPrompt } from './r5_meta.prompt';
export { coherencePrompt } from './r6_coherence.prompt';

export { urlContextPrompt } from './tools/urlContext.prompt';

console.log('[DotPrompt]      All prompt modules registered');
