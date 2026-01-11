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
  timestamp: Date.now(),
  // Добавляем датчики из Arduino
  sensor1: true,
  sensor2: true,
  sensor3: true,
  sensor4: true
};

let commands = [];
let eventHistory = [];

// ===== API =====

// POST /api/update - получить данные от Arduino
app.post('/api/update', (req, res) => {
  console.log('\n📨 POST /api/update получена!');
  console.log('Тело запроса:', JSON.stringify(req.body, null, 2));
  
  // Обновляем статус
  deviceStatus = { ...deviceStatus, ...req.body, timestamp: Date.now() };
  
  console.log('📊 Обновлён deviceStatus:', JSON.stringify(deviceStatus, null, 2));
  
  // Готовим команды для отправки обратно
  const cmdsToSend = [...commands];
  console.log(`📤 Отправляем команды (${cmdsToSend.length} шт):`, cmdsToSend);
  
  // Очищаем очередь команд
  commands = [];
  
  // Логируем событие
  addEvent(`Получены данные от Arduino: armed=${deviceStatus.armed}, alarm=${deviceStatus.alarm}`, 'info');
  
  // Отправляем ответ с командами
  res.json({ commands: cmdsToSend });
});

// GET /api/status - получить текущий статус
app.get('/api/status', (req, res) => {
  console.log('📋 GET /api/status');
  res.json(deviceStatus);
});

// POST /api/command - получить новую команду от веб-интерфейса
app.post('/api/command', (req, res) => {
  const { command } = req.body;
  
  console.log('\n🎮 POST /api/command получена!');
  console.log('Команда:', command);
  
  if (command && command.length > 0) {
    commands.push(command);
    console.log(`✅ Команда добавлена в очередь (всего ${commands.length})`);
    
    addEvent(`Команда: ${command}`, 'command');
    
    res.json({ ok: true, queued: commands.length });
  } else {
    console.log('❌ Команда пуста');
    res.json({ ok: false, error: 'Empty command' });
  }
});

// GET /api/commands - получить очередь команд
app.get('/api/commands', (req, res) => {
  console.log('📤 GET /api/commands');
  res.json({ commands: commands, count: commands.length });
});

// GET /api/history - получить историю событий
app.get('/api/history', (req, res) => {
  console.log('📜 GET /api/history');
  res.json(eventHistory.slice(-50));
});

// GET /api/clear-commands - очистить очередь
app.get('/api/clear-commands', (req, res) => {
  console.log('🗑️ Очистка очереди команд');
  const cleared = commands.length;
  commands = [];
  res.json({ cleared });
});

// GET / - главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== СОБЫТИЯ =====

function addEvent(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  eventHistory.push({
    time: timestamp,
    message,
    type,
    timestamp: Date.now()
  });
  
  console.log(`[${type.toUpperCase()}] ${timestamp} - ${message}`);
  
  // Храним последние 100 событий
  if (eventHistory.length > 100) eventHistory.shift();
}

// ===== ЗАПУСК =====

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       🚨 СЕРВЕР СИГНАЛИЗАЦИИ ЗАПУЩЕН!                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`Порт: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Render: https://alarm-system-aaf8.onrender.com\n`);
  
  console.log('API endpoints:');
  console.log('  POST /api/update        - получить данные от Arduino');
  console.log('  GET  /api/status        - текущий статус');
  console.log('  POST /api/command       - отправить команду Arduino');
  console.log('  GET  /api/commands      - показать очередь команд');
  console.log('  GET  /api/history       - история событий');
  console.log('  GET  /api/clear-commands - очистить очередь\n');
  
  addEvent('Сервер запущен', 'success');
  
  console.log('Ctrl+C для остановки\n');
});
