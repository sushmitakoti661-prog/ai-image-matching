const assert = require("assert");
const pool = require("../src/db/db");
const { ReviewDecisionSchema } = require("../src/services/schema");
const { createPost } = require("../src/services/postService");
const { rankImagesForPost } = require("../src/services/matchingService");
const {
  getPendingSuggestions,
  saveReview
} = require("../src/services/reviewService");
const {
  EvaluationResultSchema,
  evaluateCase,
  runEvaluation,
  closeEvaluationDatabase
} = require("../src/services/evaluationService");
const {
  EvaluationCaseSchema,
  Phase4EvaluationDataset
} = require("../data/evaluation/phase4Dataset");

async function runTests() {
  console.log("\n==================================================");
  console.log("Running Phase 4 Test Suite...");
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

  await test("Review decision schema accepts only approved or rejected", () => {
    assert.deepStrictEqual(ReviewDecisionSchema.parse({ decision: "approved" }), { decision: "approved" });
    assert.deepStrictEqual(ReviewDecisionSchema.parse({ decision: "rejected" }), { decision: "rejected" });
    assert.throws(() => ReviewDecisionSchema.parse({ decision: "pending" }));
  });

  await test("Evaluation dataset contains ten valid labeled cases", () => {
    assert.strictEqual(Phase4EvaluationDataset.length, 10);
    Phase4EvaluationDataset.forEach((testCase) => {
      assert.deepStrictEqual(EvaluationCaseSchema.parse(testCase), testCase);
    });
  });

  await test("Negative accepted candidates fail evaluation", () => {
    const result = evaluateCase(
      {
        id: "negative-check",
        expectedFilename: "fox.jpg",
        expectedNoMatch: false,
        negativeFilenames: ["wolf.jpg"]
      },
      {
        match: { filename: "fox.jpg" },
        candidates: [
          { filename: "fox.jpg", guardStatus: "accepted" },
          { filename: "wolf.jpg", guardStatus: "accepted" }
        ]
      }
    );

    assert.strictEqual(result.passed, false);
    assert.deepStrictEqual(result.negativeAccepted, ["wolf.jpg"]);
    assert.deepStrictEqual(EvaluationResultSchema.parse(result), result);
  });

  await test("Review upsert records one current decision and removes pending status", async () => {
    const post = await createPost({
      title: "Review workflow test",
      content: "A fox review workflow test image."
    });
    const matchResult = await rankImagesForPost(post.id, { limit: 1, similarityThreshold: 0 });
    assert(matchResult.candidates.length > 0, "A suggestion should be created");
    const suggestionId = await findSuggestionId(post.id);
    assert(suggestionId, "Suggestion ID should be available");

    const pendingBefore = await getPendingSuggestions();
    assert(pendingBefore.some((suggestion) => suggestion.id === suggestionId));

    const approved = await saveReview(suggestionId, { decision: "approved" });
    const rejected = await saveReview(suggestionId, { decision: "rejected" });

    assert.strictEqual(approved.suggestion_id, suggestionId);
    assert.strictEqual(rejected.suggestion_id, suggestionId);
    assert.strictEqual(rejected.decision, "rejected");
    assert.strictEqual(approved.id, rejected.id);

    const pendingAfter = await getPendingSuggestions();
    assert(!pendingAfter.some((suggestion) => suggestion.id === suggestionId));
  });

  await test("Evaluation benchmark runs all ten cases and computes precision", async () => {
    const summary = await runEvaluation();
    assert.strictEqual(summary.total, 10);
    assert(summary.passed >= 0 && summary.passed <= 10);
    assert.strictEqual(summary.failed, 10 - summary.passed);
    assert.strictEqual(summary.top1Precision, summary.passed / summary.total);
    assert.strictEqual(summary.results.length, 10);
  });

  console.log("\n==================================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================\n");

  await closeEvaluationDatabase();
  if (failed > 0) {
    process.exit(1);
  }
}

async function findSuggestionId(postId) {
  const result = await pool.query(
    "SELECT id FROM suggestions WHERE post_id = $1 ORDER BY id DESC LIMIT 1",
    [postId]
  );
  return result.rows[0]?.id || null;
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
