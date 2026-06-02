const pool = require('../config/db');

// Send message (Employer <-> Seeker)
exports.sendMessage = async (req, res) => {
  const { receiver_id, job_id, message_text } = req.body;
  const senderId = req.user.id;

  try {
    if (!receiver_id || !job_id || !message_text || message_text.trim() === '') {
      return res.status(400).json({ success: false, message: 'Receiver, job ID, and message text are required.' });
    }

    // Verify job existence
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
    if (jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Save message
    const [result] = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, job_id, message_text) VALUES (?, ?, ?, ?)',
      [senderId, receiver_id, job_id, message_text]
    );

    // Write a real notification for the receiver
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [
        receiver_id,
        req.user.role === 'seeker' ? 'Candidate Reply Received' : 'New Recruiter Message',
        req.user.role === 'seeker' 
          ? `You received a message reply from a candidate regarding "${jobs[0].title}".`
          : `You received a new update regarding your application for "${jobs[0].title}". Check your messages tab.`,
        'message'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Message transmitted successfully.',
      messageId: result.insertId
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// Get all message threads / inbox summaries for the current user
exports.getMessages = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    if (role === 'seeker') {
      // Seeker gets all messages they received or sent
      const [messages] = await pool.query(
        `SELECT m.*, j.title AS job_title, c.name AS company_name, c.logo AS company_logo
         FROM messages m
         JOIN jobs j ON m.job_id = j.id
         JOIN companies c ON j.company_id = c.id
         WHERE m.receiver_id = ? OR m.sender_id = ?
         ORDER BY m.created_at DESC`,
        [userId, userId]
      );
      return res.status(200).json({ success: true, messages });
    } else {
      // Employer / Admin / Manager: get messages involving them
      const [messages] = await pool.query(
        `SELECT m.*, j.title AS job_title, u.first_name, u.last_name, u.email AS candidate_email
         FROM messages m
         JOIN jobs j ON m.job_id = j.id
         JOIN users u ON (m.receiver_id = u.id OR m.sender_id = u.id)
         WHERE (m.sender_id = ? OR m.receiver_id = ?) AND u.id != ?
         ORDER BY m.created_at DESC`,
        [userId, userId, userId]
      );
      return res.status(200).json({ success: true, messages });
    }
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// Get conversation thread between candidate and employer/moderator
exports.getMessageThread = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { jobId, otherUserId } = req.params; // otherUserId is candidateId (seeker)
  const employerId = req.query.employer_id ? Number(req.query.employer_id) : null;

  try {
    let query = `
      SELECT m.*, 
             u_send.first_name AS sender_first_name, u_send.last_name AS sender_last_name, u_send.role AS sender_role,
             u_recv.first_name AS receiver_first_name, u_recv.last_name AS receiver_role
      FROM messages m
      JOIN users u_send ON m.sender_id = u_send.id
      JOIN users u_recv ON m.receiver_id = u_recv.id
      WHERE m.job_id = ?
    `;
    const params = [Number(jobId)];

    if (role === 'admin' || role === 'manager') {
      if (employerId) {
        query += ` AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`;
        params.push(employerId, Number(otherUserId), Number(otherUserId), employerId);
      } else {
        // Fetch all messages for this candidate and job
        query += ` AND (m.sender_id = ? OR m.receiver_id = ?)`;
        params.push(Number(otherUserId), Number(otherUserId));
      }
    } else {
      // Recruiter or Seeker: thread involving current user
      query += ` AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`;
      params.push(userId, Number(otherUserId), Number(otherUserId), userId);
    }

    query += ` ORDER BY m.created_at ASC`;

    const [messages] = await pool.query(query, params);
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Get message thread error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
