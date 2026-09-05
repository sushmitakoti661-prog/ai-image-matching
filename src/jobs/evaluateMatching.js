const {
  runEvaluation,
  closeEvaluationDatabase
} = require("../services/evaluationService");

async function runJob() {
  try {
    console.log("Starting Phase 4 matching evaluation...");
    const summary = await runEvaluation();

    summary.results.forEach((result) => {
      const expected = result.expectedNoMatch ? "No confident match" : result.expectedFilename;
      const actual = result.actualFilename || "No confident match";
      console.log(`  ${result.passed ? "PASS" : "FAIL"} ${result.id}: expected="${expected}", actual="${actual}"`);
      if (result.negativeAccepted.length > 0) {
        console.log(`    Negative candidates incorrectly accepted: ${result.negativeAccepted.join(", ")}`);
      }
    });

    console.log(`Top-1 Precision: ${(summary.top1Precision * 100).toFixed(2)}% (${summary.passed}/${summary.total})`);
    if (summary.top1Precision < 0.90) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Evaluation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeEvaluationDatabase();
  }
}

if (require.main === module) {
  runJob();
}

module.exports = { runJob };
