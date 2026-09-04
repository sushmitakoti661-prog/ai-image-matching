const express = require("express");
const router = express.Router();
const { 
  registerImage, 
  scanAndRegisterCorpus, 
  getAllImages, 
  getImageById 
} = require("../services/imageService");
const { processBatch } = require("../services/batchProcessor");
const { RegisterImageSchema, ProcessBatchSchema } = require("../services/schema");

/**
 * POST /images - Ingest/register a single image
 */
router.post("/", async (req, res) => {
  try {
    const validated = RegisterImageSchema.parse(req.body);
    const image = await registerImage(validated);
    res.status(201).json({
      status: "success",
      image
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: "Validation Error", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /images/scan - Scan image directory and register files
 */
router.post("/scan", async (req, res) => {
  try {
    const dir = req.body?.dirPath || "data/images";
    const images = await scanAndRegisterCorpus(dir);
    res.json({
      status: "success",
      message: `Scanned and registered ${images.length} images.`,
      images
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /images/process - Batch process pending images with Vision AI
 */
router.post("/process", async (req, res) => {
  try {
    const options = ProcessBatchSchema.parse(req.body || {});
    const summary = await processBatch(options);
    res.json({
      status: "success",
      summary
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: "Validation Error", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /images - List images with optional category, status, low_confidence filters
 */
router.get("/", async (req, res) => {
  try {
    const { category, status, low_confidence } = req.query;
    const images = await getAllImages({ category, status, low_confidence });
    res.json({
      status: "success",
      count: images.length,
      images
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /images/:id - Get a specific image with structured metadata
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid image ID" });
    }

    const image = await getImageById(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json({
      status: "success",
      image
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
