process.env.TZ = 'Asia/Kolkata';
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const initializeDatabase = require('./config/initDb');
const pool = require('./config/db');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const metaRoutes = require('./routes/metaRoutes');
const companyRoutes = require('./routes/companyRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes mapping
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/meta', metaRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/messages', messageRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'OverseasJobs API is running. Use /health or /api/v1/* endpoints.' });
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy.' });
});

// Seed data function to ensure instant usability
async function seedDefaultData() {
  try {
    // 1. Seed Countries
    const [existingCountries] = await pool.query('SELECT id FROM countries LIMIT 1');
    if (existingCountries.length === 0) {
      await pool.query(`
        INSERT INTO countries (name, code, currency, flag_url) VALUES 
        ('United Kingdom', 'GB', 'GBP', 'https://flagcdn.com/w320/gb.png'),
        ('Canada', 'CA', 'CAD', 'https://flagcdn.com/w320/ca.png'),
        ('Germany', 'DE', 'EUR', 'https://flagcdn.com/w320/de.png'),
        ('Japan', 'JP', 'JPY', 'https://flagcdn.com/w320/jp.png'),
        ('United States', 'US', 'USD', 'https://flagcdn.com/w320/us.png')
      `);
      console.log('🌱 Seeded default countries.');
    }

    // 2. Seed Categories
    const [existingCategories] = await pool.query('SELECT id FROM categories LIMIT 1');
    if (existingCategories.length === 0) {
      await pool.query(`
        INSERT INTO categories (name, slug, description, icon) VALUES 
        ('Software Engineering', 'software-engineering', 'Tech, backend, frontend, data science', 'code'),
        ('Healthcare & Nursing', 'healthcare-nursing', 'Medical professionals, nurses, doctors', 'heart-pulse'),
        ('Hospitality & Tourism', 'hospitality-tourism', 'Hotels, cooking, guest service', 'hotel'),
        ('Construction & Engineering', 'construction-engineering', 'Civil works, site managers, builders', 'hammer')
      `);
      console.log('🌱 Seeded default categories.');
    }

    // 3. Seed Subscription Plans
    const [existingPlans] = await pool.query('SELECT id FROM subscription_plans LIMIT 1');
    if (existingPlans.length === 0) {
      await pool.query(`
        INSERT INTO subscription_plans (name, price, billing_cycle, job_post_limit, featured_job_limit, duration_days, is_active) VALUES 
        ('Free Plan', 0.00, 'one-time', 1, 0, 30, 1),
        ('Basic Plan', 1999.00, 'monthly', 5, 1, 30, 1),
        ('Premium Plan', 4999.00, 'monthly', 20, 5, 30, 1)
      `);
      console.log('🌱 Seeded default subscription plans.');
    }
  } catch (error) {
    console.error('⚠️ Seeding error:', error);
  }
}

// Bootstrapper
async function startServer() {
  try {
    // Run DB structure creation
    await initializeDatabase();
    
    // Seed default options
    await seedDefaultData();

    app.listen(PORT, () => {
      console.log(`🚀 OverseasJobs platform API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('🛑 Unable to start Express server:', error);
    process.exit(1);
  }
}

startServer();
