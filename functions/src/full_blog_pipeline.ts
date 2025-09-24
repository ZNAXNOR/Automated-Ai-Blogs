import { https } from "firebase-functions";
import { runPipeline } from "./utils/orchestrator";

export const fullBlogPipeline = https.onRequest(async (req, res) => {
  const { trendInput, runId } = req.body.data;
  await runPipeline(trendInput, runId);
  res.sendStatus(200);
});
