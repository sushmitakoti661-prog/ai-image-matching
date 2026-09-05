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

// Phase 3 post and embedding validation schemas
const PostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  content: z.string().trim().min(1, "Content is required").max(100000)
});

const EmbeddingVectorSchema = z.array(z.number().finite()).min(1);

const EmbeddingSchema = z.object({
  entityType: z.enum(["post", "image"]),
  entityId: z.number().int().positive(),
  vector: EmbeddingVectorSchema,
  model: z.string().min(1).max(100)
});

const MatchRequestSchema = z.object({
  similarityThreshold: z.number().min(0).max(1).optional().default(0.65),
  limit: z.number().int().min(1).max(100).optional().default(10)
});

const SuggestionResultSchema = z.object({
  imageId: z.number().int().positive(),
  filename: z.string().min(1),
  similarityScore: z.number().min(-1).max(1),
  guardStatus: z.enum(["accepted", "rejected", "no_match"]),
  explanation: z.string().min(1)
});

module.exports = {
  ImageMetadataSchema,
  RegisterImageSchema,
  ProcessBatchSchema,
  PostSchema,
  EmbeddingVectorSchema,
  EmbeddingSchema,
  MatchRequestSchema,
  SuggestionResultSchema
};
