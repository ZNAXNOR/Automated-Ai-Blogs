// Ensure every prompt file is imported so its registration runs
import './flows/r1_ideate.prompt.js';
import './flows/r1_ideate_with_search.prompt.js';
import './flows/r2_angle.prompt.js';
import './flows/r3_draft.prompt.js';
import './flows/r3_draft_section.prompt.js';
import './flows/r4_meta.prompt.js';
import './flows/r5_polish.prompt.js';

import './tools/urlContext.prompt.js';

// Optionally export prompt references
export { ideationPrompt } from './flows/r1_ideate.prompt.js';
export { ideationPromptWithSearch } from './flows/r1_ideate_with_search.prompt.js';
export { anglePrompt } from './flows/r2_angle.prompt.js';
export { draftSectionPrompt } from './flows/r3_draft_section.prompt.js';
export { draftPrompt } from './flows/r3_draft.prompt.js';
export { polishPrompt } from './flows/r5_polish.prompt.js';
export { metaPrompt } from './flows/r4_meta.prompt.js';
// export { socialPrompt } from './flows/r6_social.prompt';

export { urlContextPrompt } from './tools/urlContext.prompt.js';

console.log('[DotPrompt]      All prompt    modules registered');
