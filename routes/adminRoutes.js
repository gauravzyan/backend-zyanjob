const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Apply base authentication for admin & manager roles
router.use(authenticateToken, authorizeRoles('admin', 'manager'));

// Shared administrative & operational moderation endpoints
router.get('/analytics', adminController.getAnalytics);
router.get('/employers', adminController.getEmployers);
router.get('/applications', adminController.getApplications);
router.get('/jobs', adminController.getAdminJobs);
router.patch('/employers/:id/approve', adminController.approveEmployer);
router.patch('/companies/:id/verify', adminController.verifyCompany);

// Root admin-only system configuration endpoints
router.post('/countries', authorizeRoles('admin'), adminController.addCountry);
router.post('/categories', authorizeRoles('admin'), adminController.addCategory);

// Root admin-only user database management endpoints
router.get('/users', authorizeRoles('admin'), adminController.getUsers);
router.get('/users/:id', authorizeRoles('admin'), adminController.getUserById);
router.post('/users', authorizeRoles('admin'), adminController.addUser);
router.put('/users/:id', authorizeRoles('admin'), adminController.updateUser);
router.delete('/users/:id', authorizeRoles('admin'), adminController.deleteUser);

module.exports = router;
