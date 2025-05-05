import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { info, error } from '../utils/logger.js';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Endpoint to get store data by store number
router.post('/store-data', async (req, res) => {
  try {
    const { store_number } = req.body;
    
    if (!store_number) {
      return res.status(400).json({ error: 'Store number is required' });
    }
    
    // Path to the Circle K stores data file
    const storesFilePath = path.join(__dirname, '../../src/assets/circle-k/circle_k_stores.json');
    
    // Check if the file exists
    if (!fs.existsSync(storesFilePath)) {
      error(`Store data file not found at ${storesFilePath}`);
      return res.status(404).json({ error: 'Store data file not found' });
    }
    
    // Read and parse the stores data
    const storesData = JSON.parse(fs.readFileSync(storesFilePath, 'utf8'));
    
    // Find the store by location number
    const store = storesData.find(store => store.location_number === store_number);
    
    if (!store) {
      return res.status(404).json({ 
        error: `Store with location number ${store_number} not found`
      });
    }
    
    // Return the store data
    return res.json({
      address: store.address || '',
      city: store.city || '',
      state: store.state || '',
      zip: store.zip || ''
    });
    
  } catch (err) {
    error(`Error fetching store data: ${err.message}`);
    return res.status(500).json({ error: 'Failed to fetch store data' });
  }
});

// Implementation for document generation
router.post('/generate-document', async (req, res) => {
  try {
    const data = req.body;
    
    // Validate required fields
    const requiredFields = ['store_number', 'address', 'city', 'state', 'zip', 'technician_name'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }
    
    // Log the request for diagnostic purposes
    info(`Circle K document generation requested for store: ${data.store_number}`);

    // Process signature if included
    if (data.signature_image) {
      // Extract base64 image data
      const base64Data = data.signature_image.split(',')[1];
      // Create a temporary file to store the signature
      const signatureTempDir = path.join(os.tmpdir(), 'circle-k-signatures');
      fs.mkdirSync(signatureTempDir, { recursive: true });
      const signatureFileName = `signature_${uuidv4()}.png`;
      const signaturePath = path.join(signatureTempDir, signatureFileName);
      
      // Save the signature image to the temp file
      fs.writeFileSync(signaturePath, Buffer.from(base64Data, 'base64'));
      
      // Update data with signature path for Python script
      data.signature_path = signaturePath;
      delete data.signature_image;  // Remove the base64 data to reduce payload size
    }
    
    // Path to the document template
    const templatePath = path.join(__dirname, '../../src/assets/circle-k/Circle K Template.docx');
    
    // Path to the Python script
    const scriptPath = path.join(__dirname, '../../src/assets/circle-k/document_generator.py');
    
    // Check if files exist
    if (!fs.existsSync(templatePath)) {
      error(`Template file not found: ${templatePath}`);
      return res.status(500).json({ error: 'Template file not found' });
    }
    
    if (!fs.existsSync(scriptPath)) {
      error(`Python script not found: ${scriptPath}`);
      return res.status(500).json({ error: 'Document generator script not found' });
    }
    
    // Convert data object to JSON string for passing to Python
    const jsonData = JSON.stringify(data);
    
    // Determine Python command based on OS
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    // Create a buffer to store the output
    let outputBuffer = Buffer.alloc(0);
    let errorOutput = '';
    
    // Spawn Python process to generate document
    const pythonProcess = spawn(pythonCommand, [
      scriptPath,
      templatePath,
      jsonData
    ]);
    
    // Collect output data
    pythonProcess.stdout.on('data', (data) => {
      outputBuffer = Buffer.concat([outputBuffer, data]);
    });
    
    // Collect error data
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      error(`Python script error: ${data.toString()}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        error(`Python script exited with code ${code}: ${errorOutput}`);
        return res.status(500).json({ 
          error: 'Document generation failed',
          details: errorOutput
        });
      }
      
      // If successful, return the document
      info(`Document generated successfully for store ${data.store_number}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Circle K #${data.store_number}.docx"`);
      return res.send(outputBuffer);
    });
    
  } catch (err) {
    error(`Error in document generation: ${err.message}`);
    return res.status(500).json({ error: 'Server error while generating document' });
  }
});

export default router; 