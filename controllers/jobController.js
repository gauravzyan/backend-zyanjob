const pool = require('../config/db');

exports.createJob = async (req, res) => {
  const {
    title, category_id, country_id, city, salary_min, salary_max, currency,
    experience_years_required, education_required, job_type, vacancy_count,
    contract_duration, application_deadline, description, skills_required,
    visa_sponsorship, accommodation_provided, transportation_provided,
    medical_insurance, other_benefits, is_featured
  } = req.body;

  try {
    let companyId;
    let employerId = req.user.id;

    if (req.user.role === 'admin' || req.user.role === 'manager') {
      if (req.body.company_id) {
        companyId = Number(req.body.company_id);
      } else {
        const [cos] = await pool.query('SELECT id FROM companies LIMIT 1');
        if (cos.length === 0) {
          return res.status(400).json({ success: false, message: 'No companies registered on the platform yet. Add a company first.' });
        }
        companyId = cos[0].id;
      }
      if (req.body.employer_id) {
        employerId = Number(req.body.employer_id);
      }
    } else {
      // Recruiter/Employer Subscription Limit Verification
      const [subs] = await pool.query(`
        SELECT s.*, sp.price, sp.job_post_limit, sp.name AS plan_name
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.user_id = ? AND s.status = 'active' AND s.expires_at > NOW() AND sp.price > 0
        ORDER BY s.expires_at DESC
        LIMIT 1
      `, [req.user.id]);

      if (subs.length > 0) {
        const sub = subs[0];
        const [[{ posted_count }]] = await pool.query(
          'SELECT COUNT(*) AS posted_count FROM jobs WHERE employer_id = ? AND created_at >= ?',
          [req.user.id, sub.starts_at]
        );
        if (posted_count >= sub.job_post_limit) {
          return res.status(400).json({
            success: false,
            message: `You have reached the job posting limit for your active ${sub.plan_name} (${sub.job_post_limit} jobs). Please upgrade or renew your plan.`
          });
        }
      } else {
        // Free plan or no active subscription: 1 free post per calendar month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const [[{ month_posted_count }]] = await pool.query(
          'SELECT COUNT(*) AS month_posted_count FROM jobs WHERE employer_id = ? AND created_at >= ? AND created_at < ?',
          [req.user.id, startOfMonth, endOfMonth]
        );

        if (month_posted_count >= 1) {
          return res.status(400).json({
            success: false,
            message: 'You have already posted your 1 free job for this calendar month. Please purchase a premium subscription plan to post more jobs.'
          });
        }
      }

      const [empRows] = await pool.query('SELECT company_id FROM employers WHERE user_id = ?', [req.user.id]);
      if (empRows.length === 0 || !empRows[0].company_id) {
        return res.status(400).json({ success: false, message: 'Employer company not initialized. Please configure settings first.' });
      }
      companyId = empRows[0].company_id;
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO jobs (
        company_id, employer_id, title, slug, category_id, country_id, city,
        salary_min, salary_max, currency, experience_years_required, education_required,
        job_type, vacancy_count, contract_duration, application_deadline, description,
        skills_required, visa_sponsorship, accommodation_provided, transportation_provided,
        medical_insurance, other_benefits, is_featured, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
      [
        companyId, employerId, title, slug, category_id, country_id, city,
        salary_min || null, salary_max || null, currency || 'USD', experience_years_required || 0, education_required || null,
        job_type, vacancy_count || 1, contract_duration || null, application_deadline || null, description,
        skills_required || null, visa_sponsorship ? 1 : 0, accommodation_provided ? 1 : 0, transportation_provided ? 1 : 0,
        medical_insurance ? 1 : 0, other_benefits || null, is_featured ? 1 : 0
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Job posted successfully.',
      jobId: result.insertId,
      slug
    });
  } catch (error) {
    console.error('Create job error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getJobs = async (req, res) => {
  const {
    search, category_id, country_id, job_type, visa_sponsorship,
    accommodation_provided, is_featured, limit = 10, offset = 0
  } = req.query;

  try {
    let query = `
      SELECT j.*, c.name AS company_name, c.logo AS company_logo, c.slug AS company_slug, cat.name AS category_name, co.name AS country_name 
      FROM jobs j
      JOIN companies c ON j.company_id = c.id
      JOIN categories cat ON j.category_id = cat.id
      JOIN countries co ON j.country_id = co.id
      WHERE j.status = 'published'
    `;
    const params = [];

    if (search) {
      query += ` AND (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (category_id) {
      query += ` AND j.category_id = ?`;
      params.push(category_id);
    }
    if (country_id) {
      query += ` AND j.country_id = ?`;
      params.push(country_id);
    }
    if (job_type) {
      query += ` AND j.job_type = ?`;
      params.push(job_type);
    }
    if (visa_sponsorship) {
      query += ` AND j.visa_sponsorship = ?`;
      params.push(Number(visa_sponsorship));
    }
    if (accommodation_provided) {
      query += ` AND j.accommodation_provided = ?`;
      params.push(Number(accommodation_provided));
    }
    if (is_featured) {
      query += ` AND j.is_featured = ?`;
      params.push(Number(is_featured));
    }

    query += ` ORDER BY j.is_featured DESC, j.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ success: true, count: rows.length, jobs: rows });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getJobBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, c.name AS company_name, c.logo AS company_logo, c.slug AS company_slug, c.website AS company_website,
              c.description AS company_desc, cat.name AS category_name, co.name AS country_name 
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       JOIN categories cat ON j.category_id = cat.id
       JOIN countries co ON j.country_id = co.id
       WHERE j.slug = ?`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    pool.query('UPDATE jobs SET views_count = views_count + 1 WHERE id = ?', [rows[0].id]).catch(console.error);

    return res.status(200).json({ success: true, job: rows[0] });
  } catch (error) {
    console.error('Get job details error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

async function logUserActivity(userId, action, details) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [userId, action, details || null]
    );
  } catch (err) {
    console.error('Activity logging failed:', err);
  }
}

exports.logUserActivity = logUserActivity;

exports.applyJob = async (req, res) => {
  const { job_id, cover_letter } = req.body;
  try {
    if (!job_id) {
      return res.status(400).json({ success: false, message: 'Job ID is required.' });
    }

    let [resumes] = await pool.query('SELECT id FROM resumes WHERE user_id = ? AND is_default = 1', [req.user.id]);
    if (resumes.length === 0) {
      const [allResumes] = await pool.query('SELECT id FROM resumes WHERE user_id = ?', [req.user.id]);
      if (allResumes.length > 0) {
        await pool.query('UPDATE resumes SET is_default = 1 WHERE id = ?', [allResumes[0].id]);
        resumes = [allResumes[0]];
      } else {
        return res.status(400).json({ success: false, message: 'Please upload a resume first before applying to this job.' });
      }
    }

    await pool.query(
      'INSERT INTO applications (job_id, user_id, resume_id, cover_letter, status) VALUES (?, ?, ?, ?, ?)',
      [job_id, req.user.id, resumes[0].id, cover_letter || null, 'applied']
    );

    // Save job automatically to saved_jobs table when applied
    await pool.query(
      'INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)',
      [req.user.id, job_id]
    );

    // Create a real notifications record
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [
        req.user.id,
        'Application Submitted',
        `Your application has been received. Recruiters will contact you soon.`,
        'application'
      ]
    );

    // Write to activity_logs
    logUserActivity(req.user.id, 'APPLY_JOB', `Applied for job ID: ${job_id}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Application submitted successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'You have already applied for this job.' });
    }
    console.error('Job apply error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, j.title AS job_title, c.name AS company_name, c.logo AS company_logo, j.city AS job_city, co.name AS country_name 
       FROM applications a 
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       LEFT JOIN countries co ON j.country_id = co.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, applications: rows });
  } catch (error) {
    console.error('Get user applications error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.saveJob = async (req, res) => {
  const { job_id } = req.body;
  try {
    if (!job_id) {
      return res.status(400).json({ success: false, message: 'Job ID is required.' });
    }

    await pool.query(
      'INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)',
      [req.user.id, job_id]
    );

    logUserActivity(req.user.id, 'SAVE_JOB', `Bookmarked job ID: ${job_id}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Job bookmarked successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Job already bookmarked.' });
    }
    console.error('Save job error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.unsaveJob = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
      [req.user.id, id]
    );

    logUserActivity(req.user.id, 'UNSAVE_JOB', `Removed bookmark for job ID: ${id}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Bookmark removed successfully.' });
  } catch (error) {
    console.error('Unsave job error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sj.id as save_id, j.*, c.name AS company_name, c.logo AS company_logo
       FROM saved_jobs sj
       JOIN jobs j ON sj.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE sj.user_id = ?`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, savedJobs: rows });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.status(200).json({ success: true, notifications: rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.createJobAlert = async (req, res) => {
  const { keyword, category_id, country_id, frequency } = req.body;
  try {
    await pool.query(
      'INSERT INTO job_alerts (user_id, keyword, category_id, country_id, frequency) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, keyword || null, category_id || null, country_id || null, frequency || 'daily']
    );

    logUserActivity(req.user.id, 'CREATE_ALERT', `Created search alert for keyword: ${keyword}`).catch(console.error);

    return res.status(201).json({ success: true, message: 'Job search alert created successfully.' });
  } catch (error) {
    console.error('Create job alert error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getJobAlerts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ja.*, c.name AS category_name, co.name AS country_name 
       FROM job_alerts ja
       LEFT JOIN categories c ON ja.category_id = c.id
       LEFT JOIN countries co ON ja.country_id = co.id
       WHERE ja.user_id = ? ORDER BY ja.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, alerts: rows });
  } catch (error) {
    console.error('Get job alerts error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.deleteJobAlert = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM job_alerts WHERE user_id = ? AND id = ?',
      [req.user.id, id]
    );

    logUserActivity(req.user.id, 'DELETE_ALERT', `Deleted search alert ID: ${id}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Job search alert deleted successfully.' });
  } catch (error) {
    console.error('Delete job alert error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.withdrawApplication = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await pool.query('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    await pool.query('DELETE FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    
    logUserActivity(req.user.id, 'WITHDRAW_APPLICATION', `Withdrew application ID: ${id}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Application withdrawn successfully.' });
  } catch (error) {
    console.error('Withdraw application error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const allowed = ['applied', 'shortlisted', 'interviewing', 'accepted', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const [existing] = await pool.query('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    await pool.query('UPDATE applications SET status = ? WHERE id = ? AND user_id = ?', [status, id, req.user.id]);
    
    logUserActivity(req.user.id, 'UPDATE_APPLICATION_STATUS', `Updated status of application ID ${id} to ${status}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Application status updated successfully.' });
  } catch (error) {
    console.error('Update application status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getEmployerApplications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id as application_id, a.status, a.cover_letter, a.created_at as applied_at,
              j.id as job_id, j.title as job_title,
              u.id as applicant_id, u.first_name, u.last_name, u.email as applicant_email,
              r.id as resume_id, r.title as resume_title, r.file_path as resume_file_path
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN users u ON a.user_id = u.id
       JOIN resumes r ON a.resume_id = r.id
       WHERE j.employer_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, applications: rows });
  } catch (error) {
    console.error('Get employer applications error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.employerUpdateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const allowed = ['applied', 'shortlisted', 'interviewing', 'accepted', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const [rows] = await pool.query(
      `SELECT a.* FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ? AND j.employer_id = ?`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found for your jobs.' });
    }

    await pool.query('UPDATE applications SET status = ? WHERE id = ?', [status, id]);
    
    const candidateId = rows[0].user_id;
    const [jobRows] = await pool.query('SELECT title FROM jobs WHERE id = ?', [rows[0].job_id]);
    const jobTitle = jobRows[0] ? jobRows[0].title : 'your applied job';
    
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [
        candidateId,
        'Application Status Updated',
        `Your application status for "${jobTitle}" has been updated to "${status}".`,
        'application'
      ]
    );

    logUserActivity(req.user.id, 'EMPLOYER_UPDATE_STATUS', `Updated application ${id} status to ${status}`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Application status updated successfully.' });
  } catch (error) {
    console.error('Employer update status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
    return res.status(200).json({ success: true, message: 'All notifications cleared successfully.' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getEmployerJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.*, cat.name AS category_name, co.name AS country_name 
       FROM jobs j
       JOIN categories cat ON j.category_id = cat.id
       JOIN countries co ON j.country_id = co.id
       WHERE j.employer_id = ?
       ORDER BY j.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, count: rows.length, jobs: rows });
  } catch (error) {
    console.error('Get employer jobs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.updateJob = async (req, res) => {
  const { id } = req.params;
  const {
    title, category_id, country_id, city, salary_min, salary_max, currency,
    experience_years_required, education_required, job_type, vacancy_count,
    contract_duration, application_deadline, description, skills_required,
    visa_sponsorship, accommodation_provided, transportation_provided,
    medical_insurance, other_benefits, is_featured, status
  } = req.body;

  try {
    // 1. Verify job exists and belongs to this employer
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    if (jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job opening not found.' });
    }

    const job = jobs[0];
    if (job.employer_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this job opening.' });
    }

    // 2. Update job
    await pool.query(
      `UPDATE jobs SET 
        title = ?, category_id = ?, country_id = ?, city = ?, salary_min = ?, salary_max = ?, currency = ?,
        experience_years_required = ?, education_required = ?, job_type = ?, vacancy_count = ?,
        contract_duration = ?, application_deadline = ?, description = ?, skills_required = ?,
        visa_sponsorship = ?, accommodation_provided = ?, transportation_provided = ?,
        medical_insurance = ?, other_benefits = ?, is_featured = ?, status = ?
       WHERE id = ?`,
      [
        title || job.title,
        category_id ? Number(category_id) : job.category_id,
        country_id ? Number(country_id) : job.country_id,
        city || job.city,
        salary_min !== undefined ? (Number(salary_min) || null) : job.salary_min,
        salary_max !== undefined ? (Number(salary_max) || null) : job.salary_max,
        currency || job.currency,
        experience_years_required !== undefined ? Number(experience_years_required) : job.experience_years_required,
        education_required !== undefined ? education_required : job.education_required,
        job_type || job.job_type,
        vacancy_count !== undefined ? Number(vacancy_count) : job.vacancy_count,
        contract_duration !== undefined ? contract_duration : job.contract_duration,
        application_deadline !== undefined ? application_deadline : job.application_deadline,
        description || job.description,
        skills_required !== undefined ? skills_required : job.skills_required,
        visa_sponsorship !== undefined ? (visa_sponsorship ? 1 : 0) : job.visa_sponsorship,
        accommodation_provided !== undefined ? (accommodation_provided ? 1 : 0) : job.accommodation_provided,
        transportation_provided !== undefined ? (transportation_provided ? 1 : 0) : job.transportation_provided,
        medical_insurance !== undefined ? (medical_insurance ? 1 : 0) : job.medical_insurance,
        other_benefits !== undefined ? other_benefits : job.other_benefits,
        is_featured !== undefined ? (is_featured ? 1 : 0) : job.is_featured,
        status || job.status,
        id
      ]
    );

    return res.status(200).json({ success: true, message: 'Job opening updated successfully.' });
  } catch (error) {
    console.error('Update job error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.deleteJob = async (req, res) => {
  const { id } = req.params;
  try {
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
    if (jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job opening not found.' });
    }
    const job = jobs[0];
    if (job.employer_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied. You do not have permissions to delete this job.' });
    }

    await pool.query('DELETE FROM jobs WHERE id = ?', [id]);
    
    // Write activity log
    logUserActivity(req.user.id, 'DELETE_JOB', `Deleted job ID: ${id} (${job.title})`).catch(console.error);

    return res.status(200).json({ success: true, message: 'Job opening deleted successfully.' });
  } catch (error) {
    console.error('Delete job error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getEmployerLimits = async (req, res) => {
  try {
    const [subs] = await pool.query(`
      SELECT s.*, sp.price, sp.job_post_limit, sp.name AS plan_name
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.user_id = ? AND s.status = 'active' AND s.expires_at > NOW() AND sp.price > 0
      ORDER BY s.expires_at DESC
      LIMIT 1
    `, [req.user.id]);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const [[{ month_posted_count }]] = await pool.query(
      'SELECT COUNT(*) AS month_posted_count FROM jobs WHERE employer_id = ? AND created_at >= ? AND created_at < ?',
      [req.user.id, startOfMonth, endOfMonth]
    );

    let hasActiveSubscription = false;
    let freePostLimitReached = false;
    let planName = 'Free Tier';
    let jobPostLimit = 1;
    let postedInCurrentSub = 0;

    if (subs.length > 0) {
      const sub = subs[0];
      hasActiveSubscription = true;
      planName = sub.plan_name;
      jobPostLimit = sub.job_post_limit;

      const [[{ posted_count }]] = await pool.query(
        'SELECT COUNT(*) AS posted_count FROM jobs WHERE employer_id = ? AND created_at >= ?',
        [req.user.id, sub.starts_at]
      );
      postedInCurrentSub = posted_count;
    } else {
      if (month_posted_count >= 1) {
        freePostLimitReached = true;
      }
    }

    return res.status(200).json({
      success: true,
      has_active_subscription: hasActiveSubscription,
      free_post_limit_reached: freePostLimitReached,
      month_posted_count,
      posted_in_current_sub: postedInCurrentSub,
      job_post_limit: jobPostLimit,
      plan_name: planName
    });
  } catch (error) {
    console.error('Get employer limits error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


