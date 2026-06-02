const express = require('express');
const router = express.Router();
const metaController = require('../controllers/metaController');

router.get('/', metaController.getMetadata);

module.exports = router;
