const pool = require("../db/db");
const { scanAndRegisterCorpus } = require("../services/imageService");
const { processBatch } = require("../services/batchProcessor");

async function runJob() {
  try {
    console.log("Starting Image Ingestion & Understanding Job...");
    
    // Step 1: Scan and register all images in data/images/
    const registered = await scanAndRegisterCorpus("data/images");
    console.log(`Discovered/verified ${registered.length} images in corpus.`);

    const requestedFilenames = process.env.IMAGE_FILENAMES
      ? process.env.IMAGE_FILENAMES.split(",").map((filename) => filename.trim()).filter(Boolean)
      : null;
    const selectedImages = requestedFilenames
      ? registered.filter((image) => requestedFilenames.includes(image.filename))
      : null;

    if (requestedFilenames) {
      const selectedFilenames = new Set(selectedImages.map((image) => image.filename));
      const missingFilenames = requestedFilenames.filter((filename) => !selectedFilenames.has(filename));
      if (missingFilenames.length > 0) {
        throw new Error(`Requested verification images were not registered: ${missingFilenames.join(", ")}`);
      }
      console.log(`Selected ${selectedImages.length} images for verification: ${selectedImages.map((image) => image.filename).join(", ")}`);
    }

    // Step 2: Process batch
    const summary = await processBatch({
      batchSize: 100,
      maxRetries: 3,
      forceRecheck: process.env.FORCE_RECHECK === "true",
      images: selectedImages
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
