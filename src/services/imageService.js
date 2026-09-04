const fs = require("fs");
const path = require("path");
const pool = require("../db/db");
const { RegisterImageSchema } = require("./schema");

/**
 * Register a single image record in the database.
 */
async function registerImage(data) {
  const validated = RegisterImageSchema.parse(data);

  // Check if image path already exists
  const existing = await pool.query(
    "SELECT * FROM images WHERE path = $1",
    [validated.path]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const res = await pool.query(
    "INSERT INTO images (filename, path, status) VALUES ($1, $2, 'pending') RETURNING *",
    [validated.filename, validated.path]
  );
  return res.rows[0];
}

/**
 * Scan data/images directory recursively and register all found images.
 */
async function scanAndRegisterCorpus(dirPath = "data/images") {
  const absoluteDir = path.isAbsolute(dirPath)
    ? dirPath
    : path.join(process.cwd(), dirPath);

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Images directory does not exist: ${absoluteDir}`);
  }

  const registered = [];
  const categories = fs.readdirSync(absoluteDir);

  for (const category of categories) {
    const categoryPath = path.join(absoluteDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath);
    for (const file of files) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
        const relativePath = path.join(dirPath, category, file).replace(/\\/g, "/");
        const image = await registerImage({
          filename: file,
          path: relativePath
        });
        registered.push(image);
      }
    }
  }

  return registered;
}

/**
 * Get images pending processing.
 */
async function getPendingImages(limit = 100) {
  const res = await pool.query(
    "SELECT * FROM images WHERE status = 'pending' ORDER BY id ASC LIMIT $1",
    [limit]
  );
  return res.rows;
}

/**
 * Save validated Vision AI metadata for an image and update status.
 */
async function saveImageMetadata(imageId, metadata, lowConfidence = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert or insert metadata
    await client.query(
      `DELETE FROM image_metadata WHERE image_id = $1`,
      [imageId]
    );

    const metaRes = await client.query(
      `INSERT INTO image_metadata 
       (image_id, subject, category, attributes, caption, confidence, low_confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        imageId,
        metadata.subject,
        metadata.category,
        JSON.stringify(metadata.attributes),
        metadata.caption,
        metadata.confidence,
        lowConfidence
      ]
    );

    await client.query(
      `UPDATE images SET status = 'processed' WHERE id = $1`,
      [imageId]
    );

    await client.query("COMMIT");
    return metaRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark image processing as failed.
 */
async function markImageFailed(imageId, reason) {
  const res = await pool.query(
    `UPDATE images SET status = 'failed' WHERE id = $1 RETURNING *`,
    [imageId]
  );
  return res.rows[0];
}

/**
 * Get all images with optional metadata join and filters.
 */
async function getAllImages(filters = {}) {
  let query = `
    SELECT 
      i.id,
      i.filename,
      i.path,
      i.status,
      i.created_at,
      m.subject,
      m.category,
      m.attributes,
      m.caption,
      m.confidence,
      m.low_confidence
    FROM images i
    LEFT JOIN image_metadata m ON i.id = m.image_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    query += ` AND i.status = $${params.length}`;
  }

  if (filters.category) {
    params.push(filters.category);
    query += ` AND m.category = $${params.length}`;
  }

  if (filters.low_confidence !== undefined) {
    params.push(filters.low_confidence === "true" || filters.low_confidence === true);
    query += ` AND m.low_confidence = $${params.length}`;
  }

  query += ` ORDER BY i.id ASC`;

  const res = await pool.query(query, params);
  return res.rows;
}

/**
 * Get a single image by ID with metadata.
 */
async function getImageById(id) {
  const res = await pool.query(
    `SELECT 
       i.id,
       i.filename,
       i.path,
       i.status,
       i.created_at,
       m.subject,
       m.category,
       m.attributes,
       m.caption,
       m.confidence,
       m.low_confidence
     FROM images i
     LEFT JOIN image_metadata m ON i.id = m.image_id
     WHERE i.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

module.exports = {
  registerImage,
  scanAndRegisterCorpus,
  getPendingImages,
  saveImageMetadata,
  markImageFailed,
  getAllImages,
  getImageById
};
