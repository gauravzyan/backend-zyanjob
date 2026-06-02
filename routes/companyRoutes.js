const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', companyController.getCompanies);
router.get('/my-company', authenticateToken, authorizeRoles('employer'), companyController.getMyCompany);
router.put('/my-company', authenticateToken, authorizeRoles('employer'), companyController.updateMyCompany);
router.get('/:slug', companyController.getCompanyBySlug);

module.exports = router;
