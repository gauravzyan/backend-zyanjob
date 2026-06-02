const pool = require('../config/db');

exports.getCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies ORDER BY name ASC');
    return res.status(200).json({ success: true, count: rows.length, companies: rows });
  } catch (error) {
    console.error('Get companies error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getCompanyBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const [compRows] = await pool.query('SELECT * FROM companies WHERE slug = ?', [slug]);
    if (compRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }
    const company = compRows[0];

    // Fetch published jobs posted by this company
    const [jobRows] = await pool.query(
      `SELECT j.*, cat.name AS category_name, co.name AS country_name 
       FROM jobs j
       JOIN categories cat ON j.category_id = cat.id
       JOIN countries co ON j.country_id = co.id
       WHERE j.company_id = ? AND j.status = 'published'
       ORDER BY j.created_at DESC`,
      [company.id]
    );

    return res.status(200).json({
      success: true,
      company,
      jobs: jobRows
    });
  } catch (error) {
    console.error('Get company details error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getMyCompany = async (req, res) => {
  try {
    const [empRows] = await pool.query(
      'SELECT company_id FROM employers WHERE user_id = ?',
      [req.user.id]
    );

    if (empRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruiter profile not found.' });
    }

    const { company_id } = empRows[0];
    if (!company_id) {
      return res.status(200).json({ success: true, company: null });
    }

    const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [company_id]);
    if (compRows.length === 0) {
      return res.status(200).json({ success: true, company: null });
    }

    return res.status(200).json({ success: true, company: compRows[0] });
  } catch (error) {
    console.error('Get my company error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.updateMyCompany = async (req, res) => {
  const { name, logo, website, description, industry, company_size, headquarters } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const [empRows] = await pool.query(
      'SELECT company_id FROM employers WHERE user_id = ?',
      [req.user.id]
    );

    if (empRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruiter profile not found.' });
    }

    const { company_id } = empRows[0];

    if (company_id) {
      // Update existing company
      await pool.query(
        `UPDATE companies SET 
          name = ?, slug = ?, logo = ?, website = ?, description = ?, industry = ?, company_size = ?, headquarters = ?
         WHERE id = ?`,
        [name, slug, logo || null, website || null, description || null, industry || null, company_size || null, headquarters || null, company_id]
      );

      const [updated] = await pool.query('SELECT * FROM companies WHERE id = ?', [company_id]);
      return res.status(200).json({
        success: true,
        message: 'Company profile updated successfully.',
        company: updated[0]
      });
    } else {
      // Create new company
      const [compResult] = await pool.query(
        `INSERT INTO companies (name, slug, logo, website, description, industry, company_size, headquarters) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, slug, logo || null, website || null, description || null, industry || null, company_size || null, headquarters || null]
      );
      
      const newCompanyId = compResult.insertId;

      await pool.query(
        'UPDATE employers SET company_id = ? WHERE user_id = ?',
        [newCompanyId, req.user.id]
      );

      const [updated] = await pool.query('SELECT * FROM companies WHERE id = ?', [newCompanyId]);
      return res.status(200).json({
        success: true,
        message: 'Company profile created and linked successfully.',
        company: updated[0]
      });
    }
  } catch (error) {
    console.error('Update my company error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
