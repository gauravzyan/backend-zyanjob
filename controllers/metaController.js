const pool = require('../config/db');

exports.getMetadata = async (req, res) => {
  try {
    const [countries] = await pool.query('SELECT * FROM countries WHERE is_active = 1');
    const [categories] = await pool.query('SELECT * FROM categories WHERE is_active = 1');
    return res.status(200).json({ success: true, countries, categories });
  } catch (error) {
    console.error('Get metadata error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
