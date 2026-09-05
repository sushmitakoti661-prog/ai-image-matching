require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT COUNT(*) FROM images WHERE status = 'processed'")
  .then(result => {
    console.log('Processed images:', result.rows[0].count);
    return pool.query("SELECT COUNT(*) FROM images");
  })
  .then(result => {
    console.log('Total images:', result.rows[0].count);
    pool.end();
  })
  .catch(err => {
    console.error('Query failed:', err.message);
    pool.end();
  });