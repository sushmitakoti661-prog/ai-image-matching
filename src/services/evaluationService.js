const { z } = require("zod");
const pool = require("../db/db");
const { createPost } = require("./postService");
const { rankImagesForPost } = require("./matchingService");
const { Phase4EvaluationDataset } = require("../../data/evaluation/phase4Dataset");

const EvaluationResultSchema = z.object({
  id: z.string().min(1),
  expectedFilename: z.string().min(1).nullable(),
  actualFilename: z.string().min(1).nullable(),
  expectedNoMatch: z.boolean(),
  negativeAccepted: z.array(z.string()),
  passed: z.boolean()
});

function evaluateCase(testCase, matchResult) {
  const actualFilename = matchResult.match?.filename || null;
  const negativeSet = new Set(testCase.negativeFilenames);
  const negativeAccepted = matchResult.candidates
    .filter((candidate) => candidate.guardStatus === "accepted" && negativeSet.has(candidate.filename))
    .map((candidate) => candidate.filename);
  const expectedResultMatches = testCase.expectedNoMatch
    ? actualFilename === null
    : actualFilename === testCase.expectedFilename;
  const passed = expectedResultMatches && negativeAccepted.length === 0;

  return EvaluationResultSchema.parse({
    id: testCase.id,
    expectedFilename: testCase.expectedFilename || null,
    actualFilename,
    expectedNoMatch: testCase.expectedNoMatch,
    negativeAccepted,
    passed
  });
}

async function runEvaluation(dataset = Phase4EvaluationDataset) {
  const results = [];

  for (const testCase of dataset) {
    const post = await createPost({
      title: testCase.title,
      content: testCase.content
    });
    const matchResult = await rankImagesForPost(post.id, {
      limit: 100
    });
    results.push(evaluateCase(testCase, matchResult));
  }

  const passed = results.filter((result) => result.passed).length;
  const precision = results.length === 0 ? 0 : passed / results.length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    top1Precision: precision,
    results
  };
}

async function closeEvaluationDatabase() {
  await pool.end();
}

module.exports = {
  EvaluationResultSchema,
  evaluateCase,
  runEvaluation,
  closeEvaluationDatabase
};
