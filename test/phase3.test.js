const assert = require("assert");
const pool = require("../src/db/db");
const {
  ImageMetadataSchema,
  PostSchema,
  EmbeddingSchema,
  MatchRequestSchema,
  SuggestionResultSchema
} = require("../src/services/schema");
const {
  EMBEDDING_DIMENSIONS,
  generateLocalEmbedding,
  normalizeVector
} = require("../src/services/embeddingService");
const {
  DEFAULT_SIMILARITY_THRESHOLD,
  cosineSimilarity,
  inferPostSignals,
  guardCandidate,
  rankImagesForPost
} = require("../src/services/matchingService");
const { createPost } = require("../src/services/postService");

async function runTests() {
  console.log("\n==================================================");
  console.log("Running Phase 3 Test Suite...");
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

  await test("Zod schemas validate posts, embeddings, match requests, and suggestions", () => {
    const post = PostSchema.parse({ title: "Fox ecology", content: "A study of red fox habitat." });
    const embedding = EmbeddingSchema.parse({
      entityType: "post",
      entityId: 1,
      vector: [0.5, 0.5],
      model: "local-hash-v1"
    });
    const request = MatchRequestSchema.parse({});
    const suggestion = SuggestionResultSchema.parse({
      imageId: 1,
      filename: "fox.jpg",
      similarityScore: 0.9,
      guardStatus: "accepted",
      explanation: "Accepted"
    });

    assert.strictEqual(post.title, "Fox ecology");
    assert.strictEqual(embedding.entityType, "post");
    assert.strictEqual(request.similarityThreshold, DEFAULT_SIMILARITY_THRESHOLD);
    assert.strictEqual(suggestion.guardStatus, "accepted");
    assert.throws(() => PostSchema.parse({ title: "", content: "body" }));
  });

  await test("Local embeddings are deterministic, normalized, and fixed-size", () => {
    const first = generateLocalEmbedding("red fox woodland");
    const second = generateLocalEmbedding("red fox woodland");
    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));

    assert.deepStrictEqual(first, second);
    assert.strictEqual(first.length, EMBEDDING_DIMENSIONS);
    assert(Math.abs(magnitude - 1) < 0.000001);
    assert.throws(() => normalizeVector([0, 0]));
  });

  await test("Cosine similarity ranks identical vectors highest", () => {
    const fox = generateLocalEmbedding("red fox woodland");
    const wolf = generateLocalEmbedding("grey wolf forest");
    const foxScore = cosineSimilarity(fox, fox);
    const wolfScore = cosineSimilarity(fox, wolf);

    assert.strictEqual(foxScore, 1);
    assert(foxScore > wolfScore);
    assert.throws(() => cosineSimilarity([1], [1, 0]));
  });

  await test("Post signal inference identifies fox animal posts", () => {
    assert.deepStrictEqual(
      inferPostSignals({ title: "Red Fox Ecology", content: "Foxes live in woodland habitats." }),
      { category: "animals", subject: "fox" }
    );
  });

  await test("Mismatch Guard rejects wolf candidates for fox posts", () => {
    const result = guardCandidate({
      postSignals: { category: "animals", subject: "fox" },
      image: { category: "animals", subject: "wolf", confidence: 0.95, low_confidence: false },
      similarityScore: 0.9,
      similarityThreshold: 0.65
    });

    assert.strictEqual(result.guardStatus, "rejected");
    assert.match(result.explanation, /expected fox, detected wolf/);
  });

  await test("Mismatch Guard rejects low-confidence and category-mismatched candidates", () => {
    const lowConfidence = guardCandidate({
      postSignals: { category: "animals", subject: "fox" },
      image: { category: "animals", subject: "fox", confidence: 0.4, low_confidence: true },
      similarityScore: 0.9,
      similarityThreshold: 0.65
    });
    const categoryMismatch = guardCandidate({
      postSignals: { category: "animals", subject: "fox" },
      image: { category: "food", subject: "pizza", confidence: 0.95, low_confidence: false },
      similarityScore: 0.9,
      similarityThreshold: 0.65
    });

    assert.strictEqual(lowConfidence.guardStatus, "rejected");
    assert.match(lowConfidence.explanation, /low detection confidence/);
    assert.strictEqual(categoryMismatch.guardStatus, "rejected");
    assert.match(categoryMismatch.explanation, /Category mismatch/);
  });

  await test("Mismatch Guard rejects similarity below the configured threshold", () => {
    const result = guardCandidate({
      postSignals: { category: null, subject: null },
      image: { category: "other", subject: "topic", confidence: 0.95, low_confidence: false },
      similarityScore: 0.2,
      similarityThreshold: 0.65
    });

    assert.strictEqual(result.guardStatus, "rejected");
    assert.match(result.explanation, /No confident match/);
  });

  await test("Database matching ranks fox first and rejects wolf", async () => {
    const post = await createPost({
      title: "The Secret Life of the Red Fox",
      content: "Red foxes live in North American woodlands and adapt to winter conditions."
    });
    const result = await rankImagesForPost(post.id, { limit: 44 });
    const fox = result.candidates.find((candidate) => candidate.filename === "fox_woodland_1.jpg");
    const wolf = result.candidates.find((candidate) => candidate.filename === "wolf_howling_1.jpg");

    assert(fox, "Fox candidate should be present");
    assert.strictEqual(result.match.filename, "fox_woodland_1.jpg");
    assert.strictEqual(fox.guardStatus, "accepted");
    assert(wolf, "Wolf candidate should be present");
    assert.strictEqual(wolf.guardStatus, "rejected");
    assert.match(wolf.explanation, /expected fox, detected wolf/);
  });

  await test("Database matching returns no confident match for unrelated content", async () => {
    const post = await createPost({
      title: "Quantum Computing Algorithms",
      content: "This article explains qubits, quantum gates, and error correction."
    });
    const result = await rankImagesForPost(post.id, { similarityThreshold: 1 });

    assert.strictEqual(result.match, null);
    assert.strictEqual(result.noMatch, true);
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
