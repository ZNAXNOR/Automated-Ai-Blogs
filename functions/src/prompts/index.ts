// Ensure every prompt file is imported so its registration runs
import "./flows/r1_ideate.prompt";
import "./flows/r1_ideate_with_search.prompt";
import "./flows/r2_angle.prompt";
import "./flows/r3_draft.prompt";
import "./flows/r3_draft_section.prompt";
import "./flows/r4_meta.prompt";
import "./flows/r5_polish.prompt";

import "./tools/urlContext.prompt";

// Optionally export prompt references
export {ideationPrompt} from "./flows/r1_ideate.prompt";
export {ideationPromptWithSearch} from "./flows/r1_ideate_with_search.prompt";
export {anglePrompt} from "./flows/r2_angle.prompt";
export {draftSectionPrompt} from "./flows/r3_draft_section.prompt";
export {draftPrompt} from "./flows/r3_draft.prompt";
export {polishPrompt} from "./flows/r5_polish.prompt";
export {metaPrompt} from "./flows/r4_meta.prompt";
// export { socialPrompt } from './flows/r6_social.prompt';

export {urlContextPrompt} from "./tools/urlContext.prompt";

console.log("[DotPrompt]      All prompt    modules registered");
