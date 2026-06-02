const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const resumeController = require('../controllers/resumeController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word docs are allowed.'));
    }
  }
});

router.post('/upload', authenticateToken, authorizeRoles('seeker'), upload.single('resume'), resumeController.uploadResume);
router.get('/', authenticateToken, authorizeRoles('seeker'), resumeController.getResumes);
router.patch('/:id/default', authenticateToken, authorizeRoles('seeker'), resumeController.setDefaultResume);
router.delete('/:id', authenticateToken, authorizeRoles('seeker'), resumeController.deleteResume);

module.exports = router;
