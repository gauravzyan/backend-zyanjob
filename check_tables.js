require('dotenv').config();
const pool = require('./config/db');

async function run() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log("=== TABLES IN DATABASE ===");
    console.log(tables);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
