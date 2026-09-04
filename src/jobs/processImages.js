const pool = require("../db/db");
const { scanAndRegisterCorpus } = require("../services/imageService");
const { processBatch } = require("../services/batchProcessor");

async function runJob() {
  try {
    console.log("Starting Image Ingestion & Understanding Job...");
    
    // Step 1: Scan and register all images in data/images/
    const registered = await scanAndRegisterCorpus("data/images");
    console.log(`Discovered/verified ${registered.length} images in corpus.`);

    // Step 2: Process batch
    const summary = await processBatch({
      batchSize: 100,
      maxRetries: 3,
      forceRecheck: process.env.FORCE_RECHECK === "true"
    });

    if (summary.failed > 0) {
      console.warn(`Job completed with ${summary.failed} failures.`);
      process.exitCode = 1;
    } else {
      console.log("Job completed successfully!");
    }
  } catch (error) {
    console.error("Job execution failed:", error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runJob();
}

module.exports = { runJob };
