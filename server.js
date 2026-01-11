const express = require('express');
const http = require('http');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ★ СТАТУС СИСТЕМЫ ★
let systemStatus = {
  armed: false,
  alarm_active: false,
  sensor1: true,
  sensor2: true,
  sensor3: true,
  sensor4: true,
  main_power: true,
  backup_power: true,
  temperature: 0,
  load1: false,
  load2: false,
  last_update: 'never'
};

let commandQueue = [];
let eventHistory = [];

// ═══════════════════════════════════════════════════════════════════════════
// API ENDPOINTS (для SIM800 и веб-панели)
// ═══════════════════════════════════════════════════════════════════════════

// ★ GET запрос для SIM800 (простой HTTP) ★
app.get('/api/update', (req, res) => {
  console.log(`[${new Date().toISOString()}] [SIM800] GET /api/update`);
  console.log(`  Query:`, req.query);
  
  const params = req.query;
  
  // Обновляем статус из query-параметров
  if (params.armed !== undefined) systemStatus.armed = params.armed === '1';
  if (params.alarm !== undefined) systemStatus.alarm_active = params.alarm === '1';
  if (params.sensor1 !== undefined) systemStatus.sensor1 = params.sensor1 === '1';
  if (params.sensor2 !== undefined) systemStatus.sensor2 = params.sensor2 === '1';
  if (params.sensor3 !== undefined) systemStatus.sensor3 = params.sensor3 === '1';
  if (params.sensor4 !== undefined) systemStatus.sensor4 = params.sensor4 === '1';
  if (params.mainPower !== undefined) systemStatus.main_power = params.mainPower === '1';
  if (params.resPower !== undefined) systemStatus.backup_power = params.resPower === '1';
  if (params.temperature !== undefined) systemStatus.temperature = parseFloat(params.temperature);
  if (params.load1 !== undefined) systemStatus.load1 = params.load1 === '1';
  if (params.load2 !== undefined) systemStatus.load2 = params.load2 === '1';
  
  systemStatus.last_update = new Date().toISOString();
  
  // Логируем в историю
  eventHistory.push({
    timestamp: systemStatus.last_update,
    type: 'update',
    source: 'SIM800',
    data: params
  });
  
  // Ограничиваем историю до 200 событий
  if (eventHistory.length > 200) {
    eventHistory = eventHistory.slice(-200);
  }
  
  console.log(`✅ Status updated:`, systemStatus);
  
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'OK', message: 'Data received from SIM800' });
});

// GET статус системы
app.get('/api/status', (req, res) => {
  res.json(systemStatus);
});

// POST команда для контроля
app.post('/api/command', (req, res) => {
  const cmd = req.body.command || req.query.command;
  
  if (!cmd) {
    return res.status(400).json({ error: 'No command specified' });
  }
  
  const commandObj = {
    id: Date.now(),
    command: cmd,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  commandQueue.push(commandObj);
  
  // Ограничиваем очередь до 50 команд
  if (commandQueue.length > 50) {
    commandQueue = commandQueue.slice(-50);
  }
  
  console.log(`[CMD] New command: ${cmd}`);
  res.json({ status: 'OK', command: cmd, queue_length: commandQueue.length });
});

// GET очередь команд
app.get('/api/commands', (req, res) => {
  res.json(commandQueue);
});

// GET история событий
app.get('/api/history', (req, res) => {
  res.json(eventHistory.slice(-100)); // Последние 100 событий
});

// GET очистить очередь команд
app.get('/api/clear-commands', (req, res) => {
  commandQueue = [];
  res.json({ status: 'OK', message: 'Queue cleared' });
});

// ═══════════════════════════════════════════════════════════════════════════
// ВЕБ-ИНТЕРФЕЙС
// ═══════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🚨 Сигнализация</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f0f2f5;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 30px;
        }
        h1 { color: #1a1a1a; margin-bottom: 30px; text-align: center; font-size: 28px; }
        h2 { font-size: 18px; color: #1a1a1a; margin-top: 25px; margin-bottom: 15px; }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }
        .status-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #007bff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .status-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .status-value {
          font-size: 20px;
          font-weight: bold;
          color: #1a1a1a;
        }
        .btn-group {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 25px;
        }
        .btn-group.full {
          grid-template-columns: 1fr;
        }
        button {
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .btn-on { 
          background: #28a745; 
          color: white; 
        }
        .btn-on:hover { 
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        .btn-off { 
          background: #dc3545; 
          color: white; 
        }
        .btn-off:hover { 
          background: #c82333;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }
        .btn-reset { 
          background: #007bff; 
          color: white; 
        }
        .btn-reset:hover { 
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }
        .update-info {
          text-align: center;
          color: #666;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          margin-left: 10px;
        }
        .status-badge.ok {
          background: #d4edda;
          color: #155724;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚨 Система охраны</h1>
        
        <h2>Статус <span class="status-badge ok" id="last-update">Никогда</span></h2>
        <div class="status-grid">
          <div class="status-item">
            <div class="status-label">Охрана</div>
            <div class="status-value" id="armed">❌ ВЫКЛ</div>
          </div>
          <div class="status-item">
            <div class="status-label">Тревога</div>
            <div class="status-value" id="alarm">✅ НЕТ</div>
          </div>
          <div class="status-item">
            <div class="status-label">Питание ОСН</div>
            <div class="status-value" id="main-power">✅ ЕСТЬ</div>
          </div>
          <div class="status-item">
            <div class="status-label">Питание РЕЗ</div>
            <div class="status-value" id="backup-power">✅ ЕСТЬ</div>
          </div>
        </div>
        
        <h2>Датчики</h2>
        <div class="status-grid">
          <div class="status-item">
            <div class="status-label">Датчик 1</div>
            <div class="status-value" id="sensor1">✅</div>
          </div>
          <div class="status-item">
            <div class="status-label">Датчик 2</div>
            <div class="status-value" id="sensor2">✅</div>
          </div>
          <div class="status-item">
            <div class="status-label">Датчик 3</div>
            <div class="status-value" id="sensor3">✅</div>
          </div>
          <div class="status-item">
            <div class="status-label">Датчик 4</div>
            <div class="status-value" id="sensor4">✅</div>
          </div>
        </div>
        
        <h2>Прочее</h2>
        <div class="status-grid">
          <div class="status-item">
            <div class="status-label">Температура</div>
            <div class="status-value" id="temperature">--°C</div>
          </div>
        </div>
        
        <h2>Управление охраной</h2>
        <div class="btn-group full">
          <button class="btn-on" onclick="sendCommand('ARM')">✓ ОХРАНА ВКЛ</button>
          <button class="btn-off" onclick="sendCommand('DISARM')">✗ ОХРАНА ВЫКЛ</button>
          <button class="btn-reset" onclick="sendCommand('RESET')">🔔 СБРОС ТРЕВОГИ</button>
        </div>
        
        <h2>Нагрузки</h2>
        <div class="btn-group">
          <button class="btn-on" onclick="sendCommand('RELAY1_ON')">💡 НАГРУЗКА 1 ВКЛ</button>
          <button class="btn-off" onclick="sendCommand('RELAY1_OFF')">💡 НАГРУЗКА 1 ВЫКЛ</button>
          <button class="btn-on" onclick="sendCommand('RELAY2_ON')">💡 НАГРУЗКА 2 ВКЛ</button>
          <button class="btn-off" onclick="sendCommand('RELAY2_OFF')">💡 НАГРУЗКА 2 ВЫКЛ</button>
        </div>
        
        <div class="update-info">
          <p>⏱️ Обновляется каждые 5 секунд...</p>
        </div>
      </div>
      
      <script>
        function sendCommand(cmd) {
          fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
          }).then(r => r.json()).then(d => {
            console.log('✅ Command sent:', d);
          }).catch(e => console.error('❌ Error:', e));
        }
        
        function updateStatus() {
          fetch('/api/status')
            .then(r => r.json())
            .then(d => {
              document.getElementById('armed').textContent = d.armed ? '✅ ВКЛ' : '❌ ВЫКЛ';
              document.getElementById('alarm').textContent = d.alarm_active ? '🚨 ДА' : '✅ НЕТ';
              document.getElementById('sensor1').textContent = d.sensor1 ? '✅' : '❌';
              document.getElementById('sensor2').textContent = d.sensor2 ? '✅' : '❌';
              document.getElementById('sensor3').textContent = d.sensor3 ? '✅' : '❌';
              document.getElementById('sensor4').textContent = d.sensor4 ? '✅' : '❌';
              document.getElementById('main-power').textContent = d.main_power ? '✅ ЕСТЬ' : '❌ НЕТ';
              document.getElementById('backup-power').textContent = d.backup_power ? '✅ ЕСТЬ' : '❌ НЕТ';
              document.getElementById('temperature').textContent = d.temperature.toFixed(1) + '°C';
              
              const lastUpdate = new Date(d.last_update);
              const now = new Date();
              const diff = Math.round((now - lastUpdate) / 1000);
              document.getElementById('last-update').textContent = diff < 60 ? diff + 'с назад' : 'давно';
            })
            .catch(e => console.error('Error:', e));
        }
        
        // Первое обновление сразу
        updateStatus();
        
        // Автообновление каждые 5 секунд
        setInterval(updateStatus, 5000);
      </script>
    </body>
    </html>
  `;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// ЗАПУСК СЕРВЕРА
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║            🚨 СИСТЕМА ОХРАНЫ - v7.0                        ║
╚════════════════════════════════════════════════════════════╝

📡 HTTP сервер (для SIM800): 0.0.0.0:${PORT}
   Доступен: http://alarm-system-aaf8.onrender.com/
   API: /api/update (GET с query-параметрами)

🌐 Веб-панель: https://alarm-system-aaf8.onrender.com/
   
✅ Готов к подключению SIM800!
✅ Веб-панель доступна по HTTPS!
  `);
});
