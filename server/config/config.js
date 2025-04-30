import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory (2 levels up from config folder)
const rootDir = path.resolve(__dirname, '../../');

const config = {
  port: process.env.PORT || 3000,
  dataDir: path.join(rootDir, 'data'),
  logsDir: path.join(rootDir, 'logs'),
  env: process.env.NODE_ENV || 'development',
  emailConfig: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM || 'fossa-monitor@example.com',
    to: process.env.EMAIL_TO || 'recipient@example.com'
  }
};

export default config; 