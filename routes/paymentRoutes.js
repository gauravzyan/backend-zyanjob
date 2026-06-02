const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/create-order', authenticateToken, authorizeRoles('employer'), paymentController.createOrder);
router.post('/verify', authenticateToken, authorizeRoles('employer'), paymentController.verifyPayment);

module.exports = router;
