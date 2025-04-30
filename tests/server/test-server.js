import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/test', (req, res) => {
  res.json({ message: 'Test server is working!' });
});

app.listen(3003, '0.0.0.0', () => {
  console.log('Test server running on http://localhost:3003');
}); 