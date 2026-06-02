const path = require('path');
require('dotenv').config();
const pool = require('./config/db');

async function check() {
  try {
    const [jobs] = await pool.query(`
      SELECT j.id, j.title, j.city, j.country_id, co.name AS country_name
      FROM jobs j
      LEFT JOIN countries co ON j.country_id = co.id
    `);
    console.log("=== JOBS IN DB ===");
    console.log(JSON.stringify(jobs, null, 2));

    const [countries] = await pool.query('SELECT * FROM countries');
    console.log("=== COUNTRIES IN DB ===");
    console.log(JSON.stringify(countries, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
