const pool = require("./db");

async function resetStatus() {
  try {
    const res = await pool.query("UPDATE images SET status = 'pending'");
    console.log(`Reset ${res.rowCount} image records to status 'pending'.`);
  } catch (err) {
    console.error("Failed to reset status:", err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  resetStatus();
}

module.exports = { resetStatus };
