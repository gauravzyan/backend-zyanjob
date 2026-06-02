const pool = require('../config/db');

exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a PDF or DOCX file.' });
    }

    const title = req.body.title || req.file.originalname;
    const filePath = `/uploads/${req.file.filename}`;

    const [existing] = await pool.query('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
    const isDefault = existing.length === 0 ? 1 : 0;

    const [result] = await pool.query(
      'INSERT INTO resumes (user_id, title, file_path, is_default) VALUES (?, ?, ?, ?)',
      [req.user.id, title, filePath, isDefault]
    );

    return res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully.',
      resume: {
        id: result.insertId,
        title,
        filePath,
        isDefault
      }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getResumes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM resumes WHERE user_id = ?', [req.user.id]);
    return res.status(200).json({ success: true, resumes: rows });
  } catch (error) {
    console.error('Get resumes error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.setDefaultResume = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE resumes SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await pool.query('UPDATE resumes SET is_default = 1 WHERE user_id = ? AND id = ?', [req.user.id, id]);
    return res.status(200).json({ success: true, message: 'Default resume updated successfully.' });
  } catch (error) {
    console.error('Set default resume error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.deleteResume = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await pool.query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Resume not found.' });
    }

    await pool.query('DELETE FROM resumes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.status(200).json({ success: true, message: 'Resume deleted successfully.' });
  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

