/* РУ ФСБ Кутузовский ФО — минимальный сервер синхронизации.
   Раздаёт статику + хранит состояние в state.json + API для pull/push.
   Зависимости: express. Установка: npm install express */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

let serverState = null;
let serverVersion = 0;
let lastWriter = 0;

/* Загружаем сохранённое состояние */
function loadState(){
  try {
    if(fs.existsSync(STATE_FILE)){
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const data = JSON.parse(raw);
      serverState = data.state || null;
      serverVersion = data.version || 0;
      console.log('Состояние загружено, версия', serverVersion);
    }
  } catch(e){ console.error('loadState:', e.message); }
}
loadState();

/* Периодически сохраняем на диск */
function persist(){
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({state: serverState, version: serverVersion}));
  } catch(e){ console.error('persist:', e.message); }
}

/* ================= API ================= */

app.get('/api/health', (req, res) => {
  res.json({ok: true, version: serverVersion});
});

app.get('/api/state/version', (req, res) => {
  res.json({version: serverVersion});
});

app.get('/api/state', (req, res) => {
  res.json({state: serverState, version: serverVersion});
});

app.post('/api/state', (req, res) => {
  try {
    const {state, version} = req.body || {};
    if(!state) return res.status(400).json({error: 'no state'});
    /* Защита от затирания: если наш сервер новее — вернём нашу версию */
    if(typeof version === 'number' && version < serverVersion){
      return res.json({version: serverVersion, conflict: true});
    }
    serverState = state;
    serverVersion++;
    lastWriter = Date.now();
    persist();
    res.json({version: serverVersion, ok: true});
  } catch(e){
    console.error('POST /api/state:', e);
    res.status(500).json({error: 'server error'});
  }
});

/* SPA-фоллбек: всё неизвестное отдаём в index.html */
app.get('*', (req, res) => {
  if(req.path.startsWith('/api')) return res.status(404).json({error: 'not found'});
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Сервер запущен: http://localhost:' + PORT);
});