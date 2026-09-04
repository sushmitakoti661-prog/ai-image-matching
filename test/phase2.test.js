const assert = require("assert");
const pool = require("../src/db/db");
const { ImageMetadataSchema } = require("../src/services/schema");
const { checkBudgetGuard, recordAiCost, getCostSummary, calculateCost } = require("../src/services/costService");
const { getAllImages, getImageById, registerImage } = require("../src/services/imageService");
const { processBatch } = require("../src/services/batchProcessor");

async function runTests() {
  console.log("\n==================================================");
  console.log("Running Phase 2 Test Suite...");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ FAILED: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Zod Schema Validation Tests
  await test("Zod Schema: Valid metadata passes validation", () => {
    const validData = {
      subject: "fox",
      category: "animals",
      attributes: { fur: "red", setting: "snow" },
      caption: "A red fox in deep white snow.",
      confidence: 0.95
    };
    const parsed = ImageMetadataSchema.parse(validData);
    assert.strictEqual(parsed.subject, "fox");
    assert.strictEqual(parsed.category, "animals");
    assert.strictEqual(parsed.confidence, 0.95);
  });

  await test("Zod Schema: Rejects invalid category", () => {
    const invalidData = {
      subject: "alien",
      category: "extraterrestrial", // not in enum
      attributes: {},
      caption: "An unknown being.",
      confidence: 0.8
    };
    assert.throws(() => ImageMetadataSchema.parse(invalidData), /Invalid/);
  });

  await test("Zod Schema: Rejects invalid confidence score (<0 or >1)", () => {
    const invalidData = {
      subject: "fox",
      category: "animals",
      attributes: {},
      caption: "A red fox in the forest.",
      confidence: 1.5 // > 1.0
    };
    assert.throws(() => ImageMetadataSchema.parse(invalidData));
  });

  // 2. Cost Tracking & Budget Guard Tests
  await test("Cost Service: Accurately calculates token costs", () => {
    const cost = calculateCost("gemini-1.5-flash", 1000, 500);
    // (1000/1M * 0.075) + (500/1M * 0.30) = 0.000075 + 0.000150 = 0.000225
    assert.strictEqual(cost, 0.000225);
  });

  await test("Cost Service: Records cost in database and calculates summary", async () => {
    const record = await recordAiCost({
      operation: "test_cost_record",
      entityType: "test",
      entityId: 9999,
      model: "gemini-1.5-flash",
      promptTokens: 500,
      completionTokens: 200
    });
    assert(record.id, "Record should have generated ID");
    assert.strictEqual(record.operation, "test_cost_record");

    const summary = await getCostSummary();
    assert(summary.total_calls > 0, "Total calls should be > 0");
    assert(summary.total_cost_usd > 0, "Total cost should be > 0");
  });

  // 3. Database Metadata & Low-Confidence Flagging Tests
  await test("Database & Pipeline: Corpus images stored in database", async () => {
    const images = await getAllImages();
    assert(images.length >= 40, `Expected >= 40 images, got ${images.length}`);
  });

  await test("Database & Pipeline: Low-confidence images are properly flagged", async () => {
    const lowConfImages = await getAllImages({ low_confidence: true });
    assert(lowConfImages.length >= 1, `Expected at least 1 low-confidence image, got ${lowConfImages.length}`);
    
    // Check specific blurry test case
    const blurry = lowConfImages.find(img => img.filename === "animal_silhouette_blurry.jpg");
    assert(blurry, "animal_silhouette_blurry.jpg should be flagged as low confidence");
    assert(parseFloat(blurry.confidence) < 0.70, `Confidence should be < 0.70, got ${blurry.confidence}`);
    assert.strictEqual(blurry.low_confidence, true);
  });

  await test("Database & Pipeline: High-confidence images have valid structured attributes", async () => {
    const images = await getAllImages({ category: "animals" });
    const fox = images.find(img => img.filename === "fox_woodland_1.jpg");
    assert(fox, "fox_woodland_1.jpg should exist");
    assert.strictEqual(fox.subject, "fox");
    assert.strictEqual(fox.category, "animals");
    assert(parseFloat(fox.confidence) >= 0.90, `Confidence should be >= 0.90, got ${fox.confidence}`);
    assert.strictEqual(fox.low_confidence, false);
    assert(typeof fox.attributes === "object", "Attributes should be parsed JSONB object");
  });

  console.log("\n==================================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================\n");

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
