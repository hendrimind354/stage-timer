// Stage Timer — server tanpa dependensi (hanya Node.js bawaan)
// Jalankan: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// ---- State utama (satu-satunya sumber kebenaran) ----
const state = {
  durationMs: 10 * 60 * 1000, // durasi awal saat reset
  remainingMs: 10 * 60 * 1000, // sisa waktu saat berhenti
  running: false,
  endsAt: 0, // timestamp server saat waktu habis (jika running)
  message: '',
  overText: 'WAKTU HABIS',
  fontFamily: 'sans',
  blackout: false,
  warnMs: 2 * 60 * 1000, // kuning
  alertMs: 60 * 1000, // merah
  rev: 0,
};

function currentRemaining() {
  return state.running ? state.endsAt - Date.now() : state.remainingMs;
}

function freeze() {
  if (state.running) {
    state.remainingMs = state.endsAt - Date.now();
    state.running = false;
  }
}

function apply(cmd) {
  switch (cmd.type) {
    case 'start':
      if (!state.running) {
        state.endsAt = Date.now() + state.remainingMs;
        state.running = true;
      }
      break;
    case 'pause':
      freeze();
      break;
    case 'toggle':
      state.running ? freeze() : apply({ type: 'start' });
      break;
    case 'reset':
      state.running = false;
      state.remainingMs = state.durationMs;
      break;
    case 'set': {
      const ms = Math.max(0, Number(cmd.ms) || 0);
      state.durationMs = ms;
      state.remainingMs = ms;
      if (state.running) state.endsAt = Date.now() + ms;
      break;
    }
    case 'adjust': {
      const d = Number(cmd.ms) || 0;
      if (state.running) state.endsAt += d;
      else state.remainingMs += d;
      break;
    }
    case 'message':
      state.message = String(cmd.text || '').slice(0, 200);
      break;
    case 'overText':
      state.overText = String(cmd.text || 'WAKTU HABIS').slice(0, 50);
      break;
    case 'font': {
      const allowed = ['sans', 'condensed', 'mono', 'serif', 'digital'];
      if (allowed.includes(cmd.font)) state.fontFamily = cmd.font;
      break;
    }
    case 'blackout':
      state.blackout = !!cmd.on;
      break;
    case 'thresholds':
      state.warnMs = Math.max(0, Number(cmd.warnMs) || 0);
      state.alertMs = Math.max(0, Number(cmd.alertMs) || 0);
      break;
    default:
      return false;
  }
  state.rev++;
  return true;
}

// ---- SSE: dorong state ke semua layar & kontrol ----
const clients = new Set();

function snapshot() {
  return JSON.stringify({ ...state, serverNow: Date.now() });
}

function broadcast() {
  const data = `data: ${snapshot()}\n\n`;
  for (const res of clients) res.write(data);
}

// heartbeat tiap 5 detik agar koneksi tidak putus & jam klien tetap sinkron
setInterval(() => {
  const data = `data: ${snapshot()}\n\n`;
  for (const res of clients) res.write(data);
}, 5000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${snapshot()}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/api/time') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ now: Date.now() }));
  }

  if (url.pathname === '/api/cmd' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const ok = apply(JSON.parse(body));
        if (ok) broadcast();
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok }));
      } catch {
        res.writeHead(400);
        res.end('{"ok":false}');
      }
    });
    return;
  }

  // file statis
  let p = url.pathname;
  if (p === '/') p = '/control.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nStage Timer berjalan.\n');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        console.log(`  [${name}]`);
        console.log(`    Kontrol : http://${n.address}:${PORT}/control.html`);
        console.log(`    Display : http://${n.address}:${PORT}/display.html\n`);
      }
    }
  }
  console.log('  Di PC server sendiri bisa pakai http://localhost:' + PORT + '\n');
});
