const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logUserActivity } = require('./jobController');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforoverseasjobsboardplatform2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecretrefreshjwtkeyforoverseasjobsboard2026';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  const { email, password, role, first_name, last_name, phone } = req.body;
  try {
    if (!email || !password || !role || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'All mandatory fields are required.' });
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

    // If role is employer, automatically create default company profile to keep setup smooth
    if (role === 'employer') {
      const companySlug = `${first_name.toLowerCase()}-${last_name.toLowerCase()}-${Date.now()}`;
      const [compResult] = await pool.query(
        'INSERT INTO companies (name, slug, description) VALUES (?, ?, ?)',
        [`${first_name}'s Enterprise`, companySlug, 'Overseas recruitment entity. Fill in details.']
      );
      await pool.query(
        'INSERT INTO employers (user_id, company_id, job_title) VALUES (?, ?, ?)',
        [userId, compResult.insertId, 'HR Manager']
      );
    }

    const user = { id: userId, email, role };
    const tokens = generateTokens(user);

    // Log registration activity
    logUserActivity(userId, 'USER_REGISTER', `Account registered: ${email}`).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      user: { id: userId, email, role, first_name, last_name },
      ...tokens
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const tokens = generateTokens(user);

    // If employer, fetch company info
    let company = null;
    if (user.role === 'employer') {
      const [empRows] = await pool.query(
        'SELECT c.*, e.job_title FROM employers e LEFT JOIN companies c ON e.company_id = c.id WHERE e.user_id = ?',
        [user.id]
      );
      if (empRows.length > 0) {
        company = empRows[0];
      }
    }

    // Log login activity
    logUserActivity(user.id, 'USER_LOGIN', `Successful login from email: ${email}`).catch(console.error);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture
      },
      company,
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.profile_picture, u.created_at,
              ep.current_city, ep.target_country, ep.experience_years, ep.primary_skills, ep.summary,
              ep.prev_company, ep.prev_job_title, ep.prev_duration, ep.education_degree, ep.education_school, ep.cover_letter
       FROM users u
       LEFT JOIN employee_profiles ep ON u.id = ep.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    // Fetch total applied jobs count from applications table
    const [appCountRows] = await pool.query(
      'SELECT COUNT(*) as count FROM applications WHERE user_id = ?',
      [req.user.id]
    );
    user.applications_count = appCountRows[0] ? appCountRows[0].count : 0;

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.saveOnboarding = async (req, res) => {
  const { 
    current_city, target_country, experience_years, primary_skills, summary,
    prev_company, prev_job_title, prev_duration, education_degree, education_school, cover_letter
  } = req.body;
  try {
    await pool.query(
      `INSERT INTO employee_profiles (
        user_id, current_city, target_country, experience_years, primary_skills, summary,
        prev_company, prev_job_title, prev_duration, education_degree, education_school, cover_letter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         current_city = VALUES(current_city),
         target_country = VALUES(target_country),
         experience_years = VALUES(experience_years),
         primary_skills = VALUES(primary_skills),
         summary = VALUES(summary),
         prev_company = VALUES(prev_company),
         prev_job_title = VALUES(prev_job_title),
         prev_duration = VALUES(prev_duration),
         education_degree = VALUES(education_degree),
         education_school = VALUES(education_school),
         cover_letter = VALUES(cover_letter)`,
      [
        req.user.id, current_city || null, target_country || null, Number(experience_years) || 0, primary_skills || null, summary || null,
        prev_company || null, prev_job_title || null, prev_duration || null, education_degree || null, education_school || null, cover_letter || null
      ]
    );

    // Automatically initialize a default resume record if none exists so they can apply immediately
    const [existingResumes] = await pool.query('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
    if (existingResumes.length === 0) {
      await pool.query(
        'INSERT INTO resumes (user_id, title, file_path, is_default) VALUES (?, ?, ?, 1)',
        [req.user.id, 'Zyan Onboarding Resume', '/uploads/default-resume.pdf']
      );
    }

    return res.status(200).json({ success: true, message: 'Employee onboarding details saved successfully.' });
  } catch (error) {
    console.error('Onboarding save error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    const filePath = `/uploads/${req.file.filename}`;

    await pool.query(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      [filePath, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully.',
      profilePicture: filePath
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
