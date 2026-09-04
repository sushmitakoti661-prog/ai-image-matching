const { z } = require("zod");

// Structured output schema for Vision AI metadata
const ImageMetadataSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(100),
  category: z.enum(["animals", "food", "nature", "vehicles", "other"]),
  attributes: z.union([
    z.record(z.string(), z.any()),
    z.array(z.any()),
    z.any()
  ]).optional().default({}),
  caption: z.string().min(5, "Caption must be at least 5 characters").max(500),
  confidence: z.number().min(0.0).max(1.0)
});

// Ingestion validation schema
const RegisterImageSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  path: z.string().min(1, "Path is required")
});

// Batch process request schema
const ProcessBatchSchema = z.object({
  batchSize: z.number().int().min(1).max(100).optional().default(50),
  forceRecheck: z.boolean().optional().default(false)
});

module.exports = {
  ImageMetadataSchema,
  RegisterImageSchema,
  ProcessBatchSchema
};
