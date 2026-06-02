const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAnalytics = async (req, res) => {
  try {
    const [[{ total_jobs }]] = await pool.query('SELECT COUNT(*) AS total_jobs FROM jobs');
    const [[{ active_jobs }]] = await pool.query('SELECT COUNT(*) AS active_jobs FROM jobs WHERE status = "published"');
    const [[{ total_applications }]] = await pool.query('SELECT COUNT(*) AS total_applications FROM applications');
    const [[{ total_employers }]] = await pool.query('SELECT COUNT(*) AS total_employers FROM users WHERE role = "employer"');
    const [[{ total_revenue }]] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE status = "succeeded"');

    // Country wise stats
    const [countryStats] = await pool.query(
      `SELECT c.name, COUNT(j.id) AS job_count 
       FROM countries c 
       LEFT JOIN jobs j ON c.id = j.country_id 
       GROUP BY c.id`
    );

    // Category wise stats
    const [categoryStats] = await pool.query(
      `SELECT cat.name, COUNT(j.id) AS job_count 
       FROM categories cat 
       LEFT JOIN jobs j ON cat.id = j.category_id 
       GROUP BY cat.id`
    );

    return res.status(200).json({
      success: true,
      analytics: {
        total_jobs,
        active_jobs,
        total_applications,
        total_employers,
        total_revenue,
        countryStats,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Get admin analytics error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.approveEmployer = async (req, res) => {
  const { id } = req.params;
  const { is_approved } = req.body;
  try {
    await pool.query('UPDATE employers SET is_approved = ? WHERE user_id = ?', [is_approved ? 1 : 0, id]);
    return res.status(200).json({ success: true, message: `Employer status updated to ${is_approved ? 'Approved' : 'Pending'}.` });
  } catch (error) {
    console.error('Approve employer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.addCountry = async (req, res) => {
  const { name, code, currency, flag_url } = req.body;
  try {
    await pool.query(
      'INSERT INTO countries (name, code, currency, flag_url) VALUES (?, ?, ?, ?)',
      [name, code, currency || 'USD', flag_url || null]
    );
    return res.status(201).json({ success: true, message: 'Country added successfully.' });
  } catch (error) {
    console.error('Add country error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.addCategory = async (req, res) => {
  const { name, description, icon } = req.body;
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await pool.query(
      'INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)',
      [name, slug, description || null, icon || null]
    );
    return res.status(201).json({ success: true, message: 'Category added successfully.' });
  } catch (error) {
    console.error('Add category error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getEmployers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, e.job_title, e.is_approved, c.id AS company_id, c.name AS company_name, c.logo AS company_logo, c.website AS company_website, c.is_verified
      FROM users u
      JOIN employers e ON u.id = e.user_id
      LEFT JOIN companies c ON e.company_id = c.id
    `);
    return res.status(200).json({ success: true, employers: rows });
  } catch (error) {
    console.error('Get admin employers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.verifyCompany = async (req, res) => {
  const { id } = req.params;
  const { is_verified } = req.body;
  try {
    await pool.query('UPDATE companies SET is_verified = ? WHERE id = ?', [is_verified ? 1 : 0, id]);
    return res.status(200).json({ success: true, message: `Company verification status updated to ${is_verified ? 'Verified' : 'Unverified'}.` });
  } catch (error) {
    console.error('Verify company error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id AS application_id, 
        a.cover_letter, 
        a.status, 
        a.created_at AS applied_at,
        a.job_id AS job_id,
        a.user_id AS candidate_id,
        j.title AS job_title, 
        j.city AS job_city, 
        co.name AS job_country,
        u.email AS candidate_email, 
        u.first_name AS candidate_first_name, 
        u.last_name AS candidate_last_name, 
        u.phone AS candidate_phone,
        r.title AS resume_title, 
        r.file_path AS resume_path,
        c.name AS company_name
      FROM applications a
      LEFT JOIN jobs j ON a.job_id = j.id
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN resumes r ON a.resume_id = r.id
      LEFT JOIN countries co ON j.country_id = co.id
      LEFT JOIN companies c ON j.company_id = c.id
      ORDER BY a.created_at DESC
    `);
    return res.status(200).json({ success: true, count: rows.length, applications: rows });
  } catch (error) {
    console.error('Get admin applications error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, role, first_name, last_name, phone, created_at FROM users ORDER BY id DESC');
    return res.status(200).json({ success: true, count: rows.length, users: rows });
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await pool.query('SELECT id, email, role, first_name, last_name, phone, created_at FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = users[0];

    let profile = null;
    if (user.role === 'seeker') {
      const [profiles] = await pool.query('SELECT * FROM employee_profiles WHERE user_id = ?', [id]);
      profile = profiles[0] || null;
    } else if (user.role === 'employer') {
      const [employers] = await pool.query(`
        SELECT e.job_title, e.is_approved, c.id AS company_id, c.name AS company_name, c.logo AS company_logo, 
               c.website AS company_website, c.description AS company_description, c.industry AS company_industry,
               c.company_size, c.headquarters AS company_headquarters, c.is_verified AS company_is_verified
        FROM employers e 
        LEFT JOIN companies c ON e.company_id = c.id 
        WHERE e.user_id = ?
      `, [id]);
      profile = employers[0] || null;
    }

    return res.status(200).json({ success: true, user, profile });
  } catch (error) {
    console.error('Get admin user by ID error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.addUser = async (req, res) => {
  const { email, password, role, first_name, last_name, phone } = req.body;
  try {
    if (!email || !password || !role || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Mandatory fields: email, password, role, first_name, and last_name are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [email, passwordHash, role, first_name, last_name, phone || null]
    );

    const userId = result.insertId;

    if (role === 'employer') {
      const {
        company_name, company_website, company_logo, company_industry,
        company_size, company_headquarters, company_description, company_is_verified,
        recruiter_job_title, recruiter_is_approved
      } = req.body;

      const companySlug = `${first_name.toLowerCase()}-${last_name.toLowerCase()}-${Date.now()}`;
      const [compResult] = await pool.query(
        'INSERT INTO companies (name, slug, website, logo, industry, company_size, headquarters, description, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          company_name || `${first_name}'s Enterprise`,
          companySlug,
          company_website || null,
          company_logo || null,
          company_industry || null,
          company_size || null,
          company_headquarters || null,
          company_description || null,
          company_is_verified ? 1 : 0
        ]
      );

      await pool.query(
        'INSERT INTO employers (user_id, company_id, job_title, is_approved) VALUES (?, ?, ?, ?)',
        [userId, compResult.insertId, recruiter_job_title || 'HR Manager', recruiter_is_approved ? 1 : 0]
      );
    } else if (role === 'seeker') {
      const {
        current_city, target_country, experience_years, primary_skills,
        summary, prev_company, prev_job_title, prev_duration,
        education_degree, education_school, cover_letter_text
      } = req.body;

      await pool.query(
        `INSERT INTO employee_profiles (
          user_id, current_city, target_country, experience_years, primary_skills,
          summary, prev_company, prev_job_title, prev_duration, education_degree, education_school, cover_letter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, current_city || null, target_country || null, Number(experience_years) || 0, primary_skills || null,
          summary || null, prev_company || null, prev_job_title || null, prev_duration || null,
          education_degree || null, education_school || null, cover_letter_text || null
        ]
      );
    }

    return res.status(201).json({ success: true, message: 'User added successfully.', userId });
  } catch (error) {
    console.error('Add admin user error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { email, password, role, first_name, last_name, phone } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = users[0];

    let passwordHash = user.password_hash;
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const newRole = role || user.role;
    const newEmail = email || user.email;
    const newFirstName = first_name || user.first_name;
    const newLastName = last_name || user.last_name;
    const newPhone = phone !== undefined ? phone : user.phone;

    if (newEmail !== user.email) {
      const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, id]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account.' });
      }
    }

    await pool.query(
      'UPDATE users SET email = ?, password_hash = ?, role = ?, first_name = ?, last_name = ?, phone = ? WHERE id = ?',
      [newEmail, passwordHash, newRole, newFirstName, newLastName, newPhone, id]
    );

    if (newRole === 'employer') {
      const {
        company_name, company_website, company_logo, company_industry,
        company_size, company_headquarters, company_description, company_is_verified,
        recruiter_job_title, recruiter_is_approved
      } = req.body;

      const [existingEmp] = await pool.query('SELECT user_id, company_id FROM employers WHERE user_id = ?', [id]);
      let companyId;
      if (existingEmp.length === 0) {
        const companySlug = `${newFirstName.toLowerCase()}-${newLastName.toLowerCase()}-${Date.now()}`;
        const [compResult] = await pool.query(
          'INSERT INTO companies (name, slug, website, logo, industry, company_size, headquarters, description, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            company_name || `${newFirstName}'s Enterprise`,
            companySlug,
            company_website || null,
            company_logo || null,
            company_industry || null,
            company_size || null,
            company_headquarters || null,
            company_description || null,
            company_is_verified ? 1 : 0
          ]
        );
        companyId = compResult.insertId;
        await pool.query(
          'INSERT INTO employers (user_id, company_id, job_title, is_approved) VALUES (?, ?, ?, ?)',
          [id, companyId, recruiter_job_title || 'HR Manager', recruiter_is_approved ? 1 : 0]
        );
      } else {
        companyId = existingEmp[0].company_id;
        if (companyId) {
          await pool.query(
            `UPDATE companies SET 
              name = ?, website = ?, logo = ?, industry = ?, company_size = ?, headquarters = ?, description = ?, is_verified = ?
             WHERE id = ?`,
            [
              company_name || `${newFirstName}'s Enterprise`,
              company_website !== undefined ? company_website : null,
              company_logo !== undefined ? company_logo : null,
              company_industry !== undefined ? company_industry : null,
              company_size !== undefined ? company_size : null,
              company_headquarters !== undefined ? company_headquarters : null,
              company_description !== undefined ? company_description : null,
              company_is_verified ? 1 : 0,
              companyId
            ]
          );
        }
        await pool.query(
          'UPDATE employers SET job_title = ?, is_approved = ? WHERE user_id = ?',
          [recruiter_job_title || 'HR Manager', recruiter_is_approved ? 1 : 0, id]
        );
      }
    } else if (newRole === 'seeker') {
      const {
        current_city, target_country, experience_years, primary_skills,
        summary, prev_company, prev_job_title, prev_duration,
        education_degree, education_school, cover_letter_text
      } = req.body;

      const [existingProf] = await pool.query('SELECT user_id FROM employee_profiles WHERE user_id = ?', [id]);
      if (existingProf.length === 0) {
        await pool.query(
          `INSERT INTO employee_profiles (
            user_id, current_city, target_country, experience_years, primary_skills,
            summary, prev_company, prev_job_title, prev_duration, education_degree, education_school, cover_letter
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, current_city || null, target_country || null, Number(experience_years) || 0, primary_skills || null,
            summary || null, prev_company || null, prev_job_title || null, prev_duration || null,
            education_degree || null, education_school || null, cover_letter_text || null
          ]
        );
      } else {
        await pool.query(
          `UPDATE employee_profiles SET 
            current_city = ?, target_country = ?, experience_years = ?, primary_skills = ?,
            summary = ?, prev_company = ?, prev_job_title = ?, prev_duration = ?,
            education_degree = ?, education_school = ?, cover_letter = ?
           WHERE user_id = ?`,
          [
            current_city !== undefined ? current_city : null,
            target_country !== undefined ? target_country : null,
            experience_years !== undefined ? Number(experience_years) : 0,
            primary_skills !== undefined ? primary_skills : null,
            summary !== undefined ? summary : null,
            prev_company !== undefined ? prev_company : null,
            prev_job_title !== undefined ? prev_job_title : null,
            prev_duration !== undefined ? prev_duration : null,
            education_degree !== undefined ? education_degree : null,
            education_school !== undefined ? education_school : null,
            cover_letter_text !== undefined ? cover_letter_text : null,
            id
          ]
        );
      }
    }

    return res.status(200).json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update admin user error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (Number(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own administrative account.' });
    }
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete admin user error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getAdminJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT j.*, c.name AS company_name, c.logo AS company_logo, cat.name AS category_name, co.name AS country_name 
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN categories cat ON j.category_id = cat.id
      LEFT JOIN countries co ON j.country_id = co.id
      ORDER BY j.created_at DESC
    `);
    return res.status(200).json({ success: true, count: rows.length, jobs: rows });
  } catch (error) {
    console.error('Get admin jobs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


