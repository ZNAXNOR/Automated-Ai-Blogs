import { logger } from "./utils/logger";
import { runR0_Trends } from "./rounds/r0_trends";
import { Round1_Ideate } from "./rounds/r1_ideate";
import { Round2_Outline } from "./rounds/r2_outline";
import { Round3_Draft } from "./rounds/r3_draft";
import { Round4_Polish } from "./rounds/r4_polish";
import { Round5_Meta } from "./rounds/r5_meta";
import { Round6_Coherence } from "./rounds/r6_coherence";
import { Round7_Publish } from "./rounds/r7_publish";

const INITIAL_SEEDS = ["AI in marketing", "content automation", "AI marketing tools"];

/**
 * Orchestrates the full blog post generation pipeline.
 * @param {string} runId The ID of the pipeline run.
 * @returns {Promise<void>}
 */
export async function fullBlogPipeline(runId: string): Promise<void> {
    logger.info("PIPELINE_START: Starting full blog pipeline", { runId });

    try {
        logger.info("PIPELINE: Entering Round 0: Trends", { runId });
        await runR0_Trends({ runId, seeds: INITIAL_SEEDS, useLLM: false, force: true });
        logger.info("PIPELINE: Exiting Round 0: Trends", { runId });

        logger.info("PIPELINE: Entering Round 1: Ideate", { runId });
        await Round1_Ideate(runId);
        logger.info("PIPELINE: Exiting Round 1: Ideate", { runId });

        logger.info("PIPELINE: Entering Round 2: Outline", { runId });
        await Round2_Outline(runId);
        logger.info("PIPELINE: Exiting Round 2: Outline", { runId });

        logger.info("PIPELINE: Entering Round 3: Draft", { runId });
        await Round3_Draft(runId);
        logger.info("PIPELINE: Exiting Round 3: Draft", { runId });

        logger.info("PIPELINE: Entering Round 4: Polish", { runId });
        await Round4_Polish(runId);
        logger.info("PIPELINE: Exiting Round 4: Polish", { runId });

        logger.info("PIPELINE: Entering Round 5: Meta", { runId });
        await Round5_Meta(runId);
        logger.info("PIPELINE: Exiting Round 5: Meta", { runId });

        logger.info("PIPELINE: Entering Round 6: Coherence", { runId });
        await Round6_Coherence(runId);
        logger.info("PIPELINE: Exiting Round 6: Coherence", { runId });

        logger.info("PIPELINE: Entering Round 7: Publish", { runId });
        await Round7_Publish(runId);
        logger.info("PIPELINE: Exiting Round 7: Publish", { runId });

    } catch (error: any) {
        logger.error("PIPELINE_ERROR: An error occurred during the pipeline", { runId, message: error.message, stack: error.stack });
        // It's important to re-throw the error so the calling context (like a Firebase Function)
        // knows the execution failed.
        throw error;
    }

    logger.info("PIPELINE_END: Full blog pipeline finished successfully", { runId });
}
 