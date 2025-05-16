const express = require('express');
const router = express.Router();
const fileLogger = require('../utils/fileLogger');
const path = require('path');
const fs = require('fs');

// Get server logs
router.get('/server-logs', (req, res) => {
  try {
    const maxLines = req.query.maxLines ? parseInt(req.query.maxLines, 10) : 100;
    const logs = fileLogger.readServerLog(maxLines);
    
    res.json({
      success: true,
      logs,
      filePath: fileLogger.serverLogFile
    });
  } catch (error) {
    console.error('Error retrieving server logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear server logs
router.post('/clear-server-logs', (req, res) => {
  try {
    fileLogger.clearServerLog();
    
    res.json({
      success: true,
      message: 'Server logs cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing server logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all available log files
router.get('/available-logs', (req, res) => {
  try {
    const logsDir = path.join(__dirname, '../../logs');
    const logFiles = [];
    
    // Check if logs directory exists
    if (fs.existsSync(logsDir)) {
      // Check for subdirectories
      const subdirs = fs.readdirSync(logsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
        
      // Scan each subdirectory for log files
      for (const subdir of subdirs) {
        const subdirPath = path.join(logsDir, subdir);
        const files = fs.readdirSync(subdirPath)
          .filter(file => file.endsWith('.log'))
          .map(file => ({
            name: file,
            path: path.join(subdir, file),
            fullPath: path.join(subdirPath, file),
            size: fs.statSync(path.join(subdirPath, file)).size,
            modified: fs.statSync(path.join(subdirPath, file)).mtime
          }));
          
        logFiles.push(...files);
      }
    }
    
    res.json({
      success: true,
      logFiles
    });
  } catch (error) {
    console.error('Error retrieving log files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
