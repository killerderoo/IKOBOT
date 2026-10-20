// War Train — local relay server (Node 18+, no dependencies).
//  • serves the overlay:            http://localhost:8787/index.html?sse=http://localhost:8787/events
//  • pushes events to overlays:     GET  /events      (Server-Sent Events, normalised JSON)
//  • test hook:                     POST /api/emit    (localhost only; JSON body = normalised event)
//  • optional Twitch EventSub:      set TWITCH_CLIENT_ID + TWITCH_USER_TOKEN + TWITCH_BROADCASTER_LOGIN in server/.env
// Twitch tokens stay in this process — they are never sent to the browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEventSub } from './eventsub.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// minimal .env loader
const envFile = path.join(here, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const PORT = +(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const clients = new Set();
const history = [];
function broadcast(ev) {
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  history.push(ev);
  if (history.length > 50) history.shift();
  for (const res of clients) res.write(data);
  console.log(`[relay] ${ev.type} ${ev.username || ''}${ev.count ? ' x' + ev.count : ''} → ${clients.size} overlay(s)`);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('Access-Control-Allow-Origin', '*'); // lets a file:// overlay read the event stream

  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (url.pathname === '/api/emit') {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': 'content-type, x-emit-key' }); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    if (!isLocal(req) || (process.env.EMIT_KEY && req.headers['x-emit-key'] !== process.env.EMIT_KEY)) { res.writeHead(403); return res.end('forbidden'); }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try {
        const ev = JSON.parse(body);
        if (!ev || typeof ev.type !== 'string') throw new Error('missing type');
        ev.id = ev.id || `emit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        broadcast(ev);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: ev.id, overlays: clients.size }));
      } catch (e) {
        res.writeHead(400); res.end('bad json: ' + e.message);
      }
    });
    return;
  }

  // static files
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/preview.html';
  const file = path.resolve(root, '.' + p);
  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}server${path.sep}`)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`War Train relay on http://${HOST}:${PORT}`);
  console.log(`  overlay (OBS): http://${HOST}:${PORT}/index.html?sse=http://${HOST}:${PORT}/events`);
  console.log(`  preview:       http://${HOST}:${PORT}/preview.html?sse=http://${HOST}:${PORT}/events`);
  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_USER_TOKEN) {
    startEventSub({
      clientId: process.env.TWITCH_CLIENT_ID,
      token: process.env.TWITCH_USER_TOKEN,
      broadcasterLogin: process.env.TWITCH_BROADCASTER_LOGIN,
      broadcasterId: process.env.TWITCH_BROADCASTER_ID,
      hypeVersion: process.env.TWITCH_HYPE_TRAIN_VERSION || '2',
      onEvent: broadcast,
    }).catch((e) => console.error('[eventsub] failed to start:', e.message));
  } else {
    console.log('  Twitch EventSub: off (no TWITCH_CLIENT_ID / TWITCH_USER_TOKEN) — use POST /api/emit or the preview panel');
  }
});
