const express = require('express');
const app = express();

app.use(express.json());

// Простой логгер
const logs = [];

app.get('/api/value', (req, res) => {
  const value = req.query.v;
  
  if (!value) {
    return res.status(400).json({ error: 'Parameter v required' });
  }
  
  const num = parseInt(value);
  
  if (isNaN(num) || num < 0 || num > 99) {
    return res.status(400).json({ error: 'Value must be 0-99' });
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Received: ${num}`;
  logs.push(logEntry);
  
  console.log(logEntry);
  
  res.json({
    success: true,
    received: num,
    timestamp: timestamp,
    message: `Value ${num} received successfully`
  });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: logs });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    logsCount: logs.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SIM800L Server v1.0',
    endpoints: {
      '/api/value?v=XX': 'Send two-digit number (0-99)',
      '/api/logs': 'View all received values',
      '/api/status': 'Server status'
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Endpoint: /api/value?v=XX`);
});
