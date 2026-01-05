const express = require('express');
const path = require('path');
const app = express();

// Парсинг JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// ===== ДАННЫЕ =====
let deviceStatus = {
  armed: false,
  alarm: false,
  load1: false,
  load2: false,
  mainPower: true,
  resPower: true,
  temperature: 23.5,
  timestamp: Date.now()
};

let commands = [];
let eventHistory = [];

// ===== API =====
app.post('/api/update', (req, res) => {
  deviceStatus = { ...deviceStatus, ...req.body, timestamp: Date.now() };
  console.log('📊 Статус:', deviceStatus);
  
  const cmdsToSend = [...commands];
  commands = [];
  res.json({ commands: cmdsToSend });
});

app.get('/api/status', (req, res) => {
  res.json(deviceStatus);
});

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  commands.push(command);
  console.log('📤 Команда:', command);
  res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  res.json(eventHistory.slice(-20));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== СОБЫТИЯ =====
function addEvent(message, type = 'info') {
  eventHistory.push({
    time: new Date().toLocaleTimeString('ru-RU'),
    message,
    type,
    timestamp: Date.now()
  });
  
  if (eventHistory.length > 50) eventHistory.shift();
}

// ===== ЗАПУСК =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n🚨 СЕРВЕР СИГНАЛИЗАЦИИ ЗАПУЩЕН!');
  console.log(`Порт: ${PORT}`);
  console.log('http://localhost:3000');
  console.log('Ctrl+C для остановки\n');
  
  addEvent('Сервер запущен', 'success');
});
