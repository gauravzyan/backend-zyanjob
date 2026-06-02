const pool = require('./config/db');
async function run() {
  try {
    const [rows] = await pool.query('SELECT * FROM subscription_plans');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
