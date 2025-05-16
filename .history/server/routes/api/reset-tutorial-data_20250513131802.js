const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Route to reset the tutorial user data to its default state
 * POST /api/reset-tutorial-data
 */
router.post('/', async (req, res) => {
  try {
    // Path to tutorial folder
    const tutorialUserPath = path.join(process.cwd(), 'data', 'users', 'tutorial');
    
    // Check if tutorial folder exists
    try {
      await fs.access(tutorialUserPath);
    } catch (err) {
      return res.status(404).json({ success: false, message: 'Tutorial user not found' });
    }
    
    // Backup current tutorial data
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(process.cwd(), 'data', 'users', 'tutorial_backup_' + timestamp);
    
    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });
      
      // Copy all tutorial files to backup
      await exec(`cp -r ${tutorialUserPath}/* ${backupPath}/`);
      
      console.log(`Tutorial data backed up to ${backupPath}`);
    } catch (err) {
      console.error('Backup error:', err);
      // Continue even if backup fails
    }
    
    // Get the original tutorial files from GitHub or a backup source
    try {
      // In a real implementation, you might download these from a GitHub repo or restore from a template
      // Here we'll use the local copies from a backup/template location
      const templatePath = path.join(process.cwd(), 'data', 'templates', 'tutorial');
      
      try {
        await fs.access(templatePath);
      } catch (templateErr) {
        return res.status(500).json({ 
          success: false, 
          message: 'Tutorial template not found. Please check your installation.' 
        });
      }
      
      // Clear the tutorial user folder (except for certain directories that should be preserved)
      const files = await fs.readdir(tutorialUserPath);
      
      for (const file of files) {
        const filePath = path.join(tutorialUserPath, file);
        const stat = await fs.stat(filePath);
        
        // Keep archive directories but clear everything else
        if (stat.isDirectory() && (file === 'archive' || file === 'archives' || file === 'changes_archive')) {
          continue;
        }
        
        // Remove file or directory
        if (stat.isDirectory()) {
          await exec(`rm -rf ${filePath}`);
        } else {
          await fs.unlink(filePath);
        }
      }
      
      // Copy template files to tutorial user folder
      await exec(`cp -r ${templatePath}/* ${tutorialUserPath}/`);
      
      console.log('Tutorial data reset successfully');
      
      // Return success
      return res.status(200).json({ success: true, message: 'Tutorial data reset successfully' });
      
    } catch (err) {
      console.error('Error resetting tutorial data:', err);
      return res.status(500).json({ success: false, message: 'Failed to reset tutorial data', error: err.message });
    }
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router; 