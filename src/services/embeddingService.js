const crypto = require("crypto");
const pool = require("../db/db");
const {
  EmbeddingSchema,
  EmbeddingVectorSchema
} = require("./schema");

const LOCAL_EMBEDDING_MODEL = "local-hash-v6";
const EMBEDDING_DIMENSIONS = 128;

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.length > 3 && token.endsWith("s")
      ? token.slice(0, -1)
      : token);
}

function normalizeVector(vector) {
  const parsed = EmbeddingVectorSchema.parse(vector);
  const magnitude = Math.sqrt(parsed.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    throw new Error("Embedding vector cannot have zero magnitude");
  }

  return parsed.map((value) => value / magnitude);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest();
}

/**
 * Generate a deterministic local vector for development and offline tests.
 * This is intentionally labeled as a local embedding, not an AI provider.
 */
function generateLocalEmbedding(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Embedding text must be a non-empty string");
  }

  const vector = Array(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  tokens.forEach((token) => {
    const digest = hashToken(token);
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  });

  if (tokens.length === 0) {
    throw new Error("Embedding text must contain at least one token");
  }

  return normalizeVector(vector);
}

function buildPostEmbeddingText(post, inferredSignals = {}) {
  const repeatedSignals = [
    ...Array(5).fill(inferredSignals.subject || ""),
    ...Array(5).fill(inferredSignals.category || "")
  ];

  return [
    ...repeatedSignals,
    post.title,
    post.content
  ].filter(Boolean).join(" ");
}

function buildImageEmbeddingText(image) {
  const attributes = typeof image.attributes === "string"
    ? image.attributes
    : JSON.stringify(image.attributes || {});

  return [
    ...Array(5).fill(image.subject || ""),
    ...Array(5).fill(image.category || ""),
    attributes,
    image.caption
  ].filter(Boolean).join(" ");
}

async function saveEmbedding(data) {
  const validated = EmbeddingSchema.parse({
    ...data,
    vector: normalizeVector(data.vector)
  });

  const result = await pool.query(
    `INSERT INTO embeddings (entity_type, entity_id, vector, model)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_type, entity_id, model)
     DO UPDATE SET vector = EXCLUDED.vector, created_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      validated.entityType,
      validated.entityId,
      JSON.stringify(validated.vector),
      validated.model
    ]
  );

  return result.rows[0];
}

async function getEmbedding(entityType, entityId, model = LOCAL_EMBEDDING_MODEL) {
  const result = await pool.query(
    `SELECT id, entity_type, entity_id, vector, model, created_at
     FROM embeddings
     WHERE entity_type = $1 AND entity_id = $2 AND model = $3
     LIMIT 1`,
    [entityType, entityId, model]
  );

  return result.rows[0] || null;
}

async function generateAndStoreEmbedding({ entityType, entityId, text }) {
  const vector = generateLocalEmbedding(text);
  return saveEmbedding({
    entityType,
    entityId,
    vector,
    model: LOCAL_EMBEDDING_MODEL
  });
}

async function getOrCreateEmbedding({ entityType, entityId, text }) {
  const existing = await getEmbedding(entityType, entityId);
  return existing || generateAndStoreEmbedding({ entityType, entityId, text });
}

module.exports = {
  LOCAL_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  normalizeVector,
  generateLocalEmbedding,
  buildPostEmbeddingText,
  buildImageEmbeddingText,
  saveEmbedding,
  getEmbedding,
  generateAndStoreEmbedding,
  getOrCreateEmbedding
};
