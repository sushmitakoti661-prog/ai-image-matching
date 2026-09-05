const pool = require("../db/db");
const { PostSchema } = require("./schema");

async function createPost(data) {
  const validated = PostSchema.parse(data);
  const result = await pool.query(
    `INSERT INTO posts (title, content)
     VALUES ($1, $2)
     RETURNING id, title, content, created_at`,
    [validated.title, validated.content]
  );
  return result.rows[0];
}

async function getPostById(postId) {
  const result = await pool.query(
    `SELECT id, title, content, created_at
     FROM posts
     WHERE id = $1`,
    [postId]
  );
  return result.rows[0] || null;
}

async function getAllPosts() {
  const result = await pool.query(
    `SELECT id, title, content, created_at
     FROM posts
     ORDER BY id ASC`
  );
  return result.rows;
}

module.exports = {
  createPost,
  getPostById,
  getAllPosts
};
