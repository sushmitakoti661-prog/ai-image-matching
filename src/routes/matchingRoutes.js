const express = require("express");
const router = express.Router();
const { MatchRequestSchema } = require("../services/schema");
const { rankImagesForPost } = require("../services/matchingService");

router.post("/:id/match", async (req, res) => {
  try {
    const postId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(postId)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const options = MatchRequestSchema.parse(req.body || {});
    const result = await rankImagesForPost(postId, options);
    res.json({
      status: "success",
      result
    });
  } catch (err) {
    if (err.issues) {
      return res.status(400).json({ error: "Validation Error", details: err.issues });
    }
    if (err.message === "Post not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
