const { getPendingImages, saveImageMetadata, markImageFailed, getAllImages } = require("./imageService");
const { analyzeImage } = require("./visionService");
const { getCostSummary } = require("./costService");

/**
 * Process a batch of images through Vision AI pipeline with retries, progress tracking, and cost budget guards.
 */
async function processBatch(options = {}) {
  const { batchSize = 50, maxRetries = 3, forceRecheck = false } = options;

  let imagesToProcess = [];
  if (forceRecheck) {
    imagesToProcess = await getAllImages();
  } else {
    imagesToProcess = await getPendingImages(batchSize);
  }

  const total = imagesToProcess.length;
  console.log(`\n==================================================`);
  console.log(`[BatchProcessor] Starting batch processing for ${total} images...`);
  console.log(`==================================================`);

  const summary = {
    total_found: total,
    processed: 0,
    low_confidence_count: 0,
    failed: 0,
    budget_halted: false,
    results: []
  };

  for (let i = 0; i < imagesToProcess.length; i++) {
    const img = imagesToProcess[i];
    const progressPercent = (((i + 1) / total) * 100).toFixed(1);
    console.log(`[BatchProcessor] (${i + 1}/${total} - ${progressPercent}%) Processing: ${img.filename} [ID: ${img.id}]`);

    let attempts = 0;
    let success = false;
    let lastError = null;

    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        const { metadata, lowConfidence, model, cost } = await analyzeImage(img);

        await saveImageMetadata(img.id, metadata, lowConfidence);

        summary.processed++;
        if (lowConfidence) {
          summary.low_confidence_count++;
        }

        summary.results.push({
          imageId: img.id,
          filename: img.filename,
          subject: metadata.subject,
          category: metadata.category,
          confidence: metadata.confidence,
          lowConfidence,
          status: "processed"
        });

        console.log(`  ✓ Success: subject="${metadata.subject}", category="${metadata.category}", conf=${metadata.confidence}${lowConfidence ? " [FLAGGED LOW-CONFIDENCE]" : ""}`);
        success = true;
      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes("Budget Guard Alert")) {
          console.error(`  ✖ HALTED: ${err.message}`);
          summary.budget_halted = true;
          break;
        }

        console.warn(`  ⚠ Attempt ${attempts}/${maxRetries} failed for ${img.filename}: ${err.message}`);
        if (attempts < maxRetries) {
          // Exponential backoff
          await new Promise((res) => setTimeout(res, attempts * 200));
        }
      }
    }

    if (summary.budget_halted) {
      break;
    }

    if (!success) {
      await markImageFailed(img.id, lastError?.message || "Unknown error");
      summary.failed++;
      summary.results.push({
        imageId: img.id,
        filename: img.filename,
        status: "failed",
        error: lastError?.message
      });
      console.error(`  ✖ Processing failed after ${maxRetries} attempts for ${img.filename}`);
    }
  }

  const costSummary = await getCostSummary();
  summary.total_cost_usd = costSummary.total_cost_usd;
  summary.budget_remaining_usd = costSummary.budget_remaining_usd;

  console.log(`\n==================================================`);
  console.log(`[BatchProcessor] Batch Completed!`);
  console.log(`  Total: ${summary.total_found} | Processed: ${summary.processed} | Low-Conf Flagged: ${summary.low_confidence_count} | Failed: ${summary.failed}`);
  console.log(`  Total AI Cost: $${summary.total_cost_usd} (Remaining Budget: $${summary.budget_remaining_usd})`);
  console.log(`==================================================\n`);

  return summary;
}

module.exports = {
  processBatch
};
