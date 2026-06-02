const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, messageController.sendMessage);
router.get('/', authenticateToken, messageController.getMessages);
router.get('/thread/:jobId/:otherUserId', authenticateToken, messageController.getMessageThread);

module.exports = router;
