const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', jobController.getJobs);
router.get('/:slug', jobController.getJobBySlug);
router.post('/', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.createJob);
router.get('/employer/jobs', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.getEmployerJobs);
router.get('/employer/limits', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.getEmployerLimits);
router.put('/employer/jobs/:id', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.updateJob);
router.delete('/employer/jobs/:id', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.deleteJob);
router.get('/employer/applications', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.getEmployerApplications);
router.patch('/employer/applications/:id/status', authenticateToken, authorizeRoles('employer', 'admin', 'manager'), jobController.employerUpdateApplicationStatus);
router.post('/apply', authenticateToken, authorizeRoles('seeker'), jobController.applyJob);
router.get('/my/applications', authenticateToken, authorizeRoles('seeker'), jobController.getApplications);
router.delete('/applications/:id', authenticateToken, authorizeRoles('seeker'), jobController.withdrawApplication);
router.patch('/applications/:id/status', authenticateToken, authorizeRoles('seeker'), jobController.updateApplicationStatus);
router.post('/save', authenticateToken, authorizeRoles('seeker'), jobController.saveJob);
router.delete('/save/:id', authenticateToken, authorizeRoles('seeker'), jobController.unsaveJob);
router.get('/my/saved', authenticateToken, authorizeRoles('seeker'), jobController.getSavedJobs);
router.get('/my/notifications', authenticateToken, authorizeRoles('seeker'), jobController.getNotifications);
router.delete('/my/notifications', authenticateToken, authorizeRoles('seeker'), jobController.clearNotifications);
router.post('/my/alerts', authenticateToken, authorizeRoles('seeker'), jobController.createJobAlert);
router.get('/my/alerts', authenticateToken, authorizeRoles('seeker'), jobController.getJobAlerts);
router.delete('/my/alerts/:id', authenticateToken, authorizeRoles('seeker'), jobController.deleteJobAlert);

module.exports = router;
