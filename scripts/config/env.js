/**
 * Environment configuration module
 * Handles loading and accessing environment variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists
const loadEnvVars = () => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = envContent.split('\n').reduce((acc, line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          acc[key] = value;
        }
        return acc;
      }, {});
      return envVars;
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
  return {};
};

export const envVars = loadEnvVars();
export default envVars; 