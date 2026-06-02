const pool = require('./db');

const tables = [
  `CREATE TABLE IF NOT EXISTS countries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(5) NOT NULL UNIQUE,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      flag_url VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      icon VARCHAR(50) NULL,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NULL,
      role ENUM('admin', 'employer', 'seeker') NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NULL,
      profile_picture VARCHAR(255) NULL,
      google_id VARCHAR(255) NULL UNIQUE,
      is_active TINYINT(1) DEFAULT 1,
      email_verified_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(150) NOT NULL UNIQUE,
      logo VARCHAR(255) NULL,
      website VARCHAR(255) NULL,
      description TEXT NULL,
      industry VARCHAR(100) NULL,
      company_size VARCHAR(50) NULL,
      headquarters VARCHAR(150) NULL,
      is_verified TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employers (
      user_id INT PRIMARY KEY,
      company_id INT NULL,
      job_title VARCHAR(100) NULL,
      is_approved TINYINT(1) DEFAULT 0,
      subscription_plan_id INT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      employer_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      slug VARCHAR(150) NOT NULL UNIQUE,
      category_id INT NOT NULL,
      country_id INT NOT NULL,
      city VARCHAR(100) NOT NULL,
      salary_min DECIMAL(12, 2) NULL,
      salary_max DECIMAL(12, 2) NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      experience_years_required INT DEFAULT 0,
      education_required VARCHAR(150) NULL,
      job_type ENUM('full-time', 'part-time', 'contract', 'internship') NOT NULL,
      vacancy_count INT DEFAULT 1,
      contract_duration VARCHAR(100) NULL,
      application_deadline DATE NULL,
      description TEXT NOT NULL,
      skills_required TEXT NULL,
      visa_sponsorship TINYINT(1) DEFAULT 0,
      accommodation_provided TINYINT(1) DEFAULT 0,
      transportation_provided TINYINT(1) DEFAULT 0,
      medical_insurance TINYINT(1) DEFAULT 0,
      other_benefits TEXT NULL,
      is_featured TINYINT(1) DEFAULT 0,
      status ENUM('draft', 'published', 'paused', 'expired') DEFAULT 'draft',
      views_count INT DEFAULT 0,
      meta_title VARCHAR(150) NULL,
      meta_description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NOT NULL,
      user_id INT NOT NULL,
      resume_id INT NOT NULL,
      cover_letter TEXT NULL,
      status ENUM('applied', 'shortlisted', 'interviewing', 'accepted', 'rejected') DEFAULT 'applied',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
      UNIQUE KEY unique_apply (job_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      price DECIMAL(10,2) NOT NULL,
      billing_cycle ENUM('monthly', 'yearly', 'one-time') NOT NULL,
      job_post_limit INT NOT NULL,
      featured_job_limit INT NOT NULL,
      duration_days INT NOT NULL,
      is_active TINYINT(1) DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_id INT NOT NULL,
      starts_at TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
      razorpay_subscription_id VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subscription_id INT NULL,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      gateway ENUM('razorpay') NOT NULL,
      payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
      status ENUM('pending', 'succeeded', 'failed', 'refunded') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS saved_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      job_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      UNIQUE KEY unique_save (user_id, job_id)
  )`,
  `CREATE TABLE IF NOT EXISTS job_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      keyword VARCHAR(100) NULL,
      category_id INT NULL,
      country_id INT NULL,
      frequency ENUM('daily', 'weekly') DEFAULT 'daily',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(255) NOT NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS employee_profiles (
      user_id INT PRIMARY KEY,
      current_city VARCHAR(100) NULL,
      target_country VARCHAR(100) NULL,
      experience_years INT DEFAULT 0,
      primary_skills TEXT NULL,
      summary TEXT NULL,
      prev_company VARCHAR(150) NULL,
      prev_job_title VARCHAR(150) NULL,
      prev_duration VARCHAR(50) NULL,
      education_degree VARCHAR(150) NULL,
      education_school VARCHAR(150) NULL,
      cover_letter TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      job_id INT NOT NULL,
      message_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  )`
];

async function initializeDatabase() {
  try {
    for (const sql of tables) {
      await pool.query(sql);
    }
    // Ensure cover_letter column is added to existing tables
    await pool.query("ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS cover_letter TEXT NULL").catch(e => {
      // Fallback if ADD COLUMN IF NOT EXISTS is not supported in this MySQL version
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.error('Alter table warning:', e.message);
      }
    });
    // Ensure users table role column supports manager ENUM
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'employer', 'seeker', 'manager') NOT NULL").catch(e => {
      console.error('Modify role enum warning:', e.message);
    });
    console.log('✅ Database tables initialized successfully.');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = initializeDatabase;
