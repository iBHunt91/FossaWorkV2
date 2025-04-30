import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Dispenser scrape endpoint
app.post('/api/dispenser-scrape', (req, res) => {
  res.json({ message: 'Dispenser scrape job started successfully!' });
});

// Dispenser status endpoint
app.get('/api/dispenser-status', (req, res) => {
  res.json({
    status: 'idle',
    progress: 0,
    message: 'No dispenser scrape job is running',
    error: null
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Simple server listening at http://localhost:${port}`);
}); 