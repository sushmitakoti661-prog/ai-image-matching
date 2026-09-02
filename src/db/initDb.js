const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function initDb() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  try {
    await pool.query(schema);
    console.log("Database schema created successfully.");
  } catch (error) {
    console.error("Database schema creation failed:", error.message);
  } finally {
    await pool.end();
  }
}

initDb();