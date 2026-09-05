const pool = require("../db/db");
const { ReviewDecisionSchema } = require("./schema");

async function getPendingSuggestions() {
  const result = await pool.query(
    `SELECT
       s.id,
       s.post_id,
       s.image_id,
       s.similarity_score,
       s.guard_status,
       s.explanation,
       s.created_at,
       p.title AS post_title,
       i.filename,
       r.id AS review_id
     FROM suggestions s
     JOIN posts p ON p.id = s.post_id
     JOIN images i ON i.id = s.image_id
     LEFT JOIN reviews r ON r.suggestion_id = s.id
     WHERE r.id IS NULL
     ORDER BY s.created_at ASC, s.id ASC`
  );

  return result.rows;
}

async function getSuggestionById(suggestionId) {
  const result = await pool.query(
    `SELECT id, post_id, image_id, similarity_score, guard_status, explanation, created_at
     FROM suggestions
     WHERE id = $1`,
    [suggestionId]
  );
  return result.rows[0] || null;
}

async function saveReview(suggestionId, data) {
  const validated = ReviewDecisionSchema.parse(data);
  const suggestion = await getSuggestionById(suggestionId);

  if (!suggestion) {
    throw new Error("Suggestion not found");
  }

  const result = await pool.query(
    `INSERT INTO reviews (suggestion_id, decision)
     VALUES ($1, $2)
     ON CONFLICT (suggestion_id)
     DO UPDATE SET decision = EXCLUDED.decision, created_at = CURRENT_TIMESTAMP
     RETURNING id, suggestion_id, decision, created_at`,
    [suggestionId, validated.decision]
  );

  return result.rows[0];
}

module.exports = {
  getPendingSuggestions,
  getSuggestionById,
  saveReview
};
