const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingVars = requiredEnv.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  const message = `Missing required database environment variables: ${missingVars.join(', ')}.` +
    ' Set them in your deployment environment or .env file.';
  console.error('❌', message);
  throw new Error(message);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30'
});

module.exports = pool;
