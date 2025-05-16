const express = require('express');
const router = express.Router();

// Import route modules
const resetTutorialDataRouter = require('./reset-tutorial-data');

// Register routes
router.use('/reset-tutorial-data', resetTutorialDataRouter);

module.exports = router; 