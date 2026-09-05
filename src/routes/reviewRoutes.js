const express = require("express");
const router = express.Router();
const {
  getPendingSuggestions,
  saveReview
} = require("../services/reviewService");
const { ReviewDecisionSchema } = require("../services/schema");

router.get("/pending", async (req, res) => {
  try {
    const suggestions = await getPendingSuggestions();
    res.json({
      status: "success",
      count: suggestions.length,
      suggestions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/review", async (req, res) => {
  try {
    const suggestionId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(suggestionId)) {
      return res.status(400).json({ error: "Invalid suggestion ID" });
    }

    const review = await saveReview(suggestionId, ReviewDecisionSchema.parse(req.body));
    res.status(200).json({
      status: "success",
      review
    });
  } catch (err) {
    if (err.issues) {
      return res.status(400).json({ error: "Validation Error", details: err.issues });
    }
    if (err.message === "Suggestion not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
