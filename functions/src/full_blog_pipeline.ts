
import { run as r0_run } from "./rounds/r0_trends";
import { run as r1_run } from "./rounds/r1_ideate";
import { run as r2_run } from "./rounds/r2_outline";
import { run as r3_run } from "./rounds/r3_draft";
import { run as r4_run } from "./rounds/r4_polish";
import { run as r5_run } from "./rounds/r5_meta";
import { run as r6_run } from "./rounds/r6_coherence";
import { run as r7_run } from "./rounds/r7_publish";

export async function fullBlogPipeline(runId: string, seeds: string[]) {
    await r0_run({runId, seeds});
    await r1_run({runId});
    await r2_run({runId});
    await r3_run({runId});
    await r4_run({runId});
    await r5_run({runId});
    await r6_run({runId});
    await r7_run({runId});
}
