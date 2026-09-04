const express = require("express");
const router = express.Router();
const { getCostSummary } = require("../services/costService");

/**
 * GET /costs - Get AI expenditure, token metrics, and budget status
 */
router.get("/", async (req, res) => {
  try {
    const summary = await getCostSummary();
    res.json({
      status: "success",
      ...summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
