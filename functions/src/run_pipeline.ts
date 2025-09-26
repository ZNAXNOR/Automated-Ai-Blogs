import { fullBlogPipeline } from './full_blog_pipeline';
import * as admin from 'firebase-admin';

admin.initializeApp();

const runId = `manual-run-${Date.now()}`;
const seeds = ["AI in 2024", "The Future of Remote Work", "Sustainable Living"];

fullBlogPipeline(runId, seeds)
    .then(() => {
        console.log(`Pipeline completed for runId: ${runId}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`Pipeline failed for runId: ${runId}`, error);
        process.exit(1);
    });
