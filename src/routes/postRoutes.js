const express = require("express");
const router = express.Router();
const {
  createPost,
  getPostById,
  getAllPosts
} = require("../services/postService");
const { PostSchema } = require("../services/schema");

router.post("/", async (req, res) => {
  try {
    const post = await createPost(PostSchema.parse(req.body));
    res.status(201).json({
      status: "success",
      post
    });
  } catch (err) {
    if (err.issues) {
      return res.status(400).json({ error: "Validation Error", details: err.issues });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json({
      status: "success",
      count: posts.length,
      posts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const post = await getPostById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({
      status: "success",
      post
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
