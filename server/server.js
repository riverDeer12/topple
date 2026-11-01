// Topple API: device accounts, verified scores and leaderboards.
// Plain Node.js (>= 22.5), no npm packages: node:http + node:sqlite.
// Every submitted solution is replayed with web/core.js before it is stored,
// so a score can only be recorded by actually solving the puzzle.
//
// Env: PORT (8787), DB_PATH (server/topple.db), TZ_GAME (Europe/Zagreb),
//      ALLOWED_ORIGIN (* or a comma-separated list, e.g. https://topple.rdd.software,http://localhost:8080)
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const C = require('../web/core.js');
const G = require('../web/gen.js');
const LEVELS = require('../web/levels.js');
const PUZZLES = require('../web/puzzles.js');

const PORT = Number(process.env.PORT || 8787);
const ORIGINS = (process.env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
// Echo the caller's origin when it is on the list (CORS allows only one value per response).
const corsOrigin = req => ORIGINS.includes('*') ? '*' : (ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0]);
const TZ = process.env.TZ_GAME || 'Europe/Zagreb';
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'topple.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    endless_next INTEGER NOT NULL DEFAULT 1,
    endless_stars INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS campaign (
    user_id INTEGER NOT NULL REFERENCES users(id), level INTEGER NOT NULL,
    stars INTEGER NOT NULL, moves INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, level)
  );
  CREATE TABLE IF NOT EXISTS daily (
    user_id INTEGER NOT NULL REFERENCES users(id), date TEXT NOT NULL,
    moves INTEGER NOT NULL, time_ms INTEGER NOT NULL, stars INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS endless (
    user_id INTEGER NOT NULL REFERENCES users(id), n INTEGER NOT NULL,
    stars INTEGER NOT NULL, moves INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, n)
  );
  CREATE INDEX IF NOT EXISTS daily_rank ON daily (date, moves, time_ms);
`);

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const starsFor = (m, opt) => (m <= opt ? 3 : m <= opt + 2 ? 2 : 1);
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,15}$/u;

// --- puzzles ---------------------------------------------------------------
const genCache = new Map();
function puzzle(mode, key) {
  if (mode === 'campaign') return LEVELS[key - 1] || null;
  if (mode === 'daily') {
    if (PUZZLES.daily[key]) return PUZZLES.daily[key];
    if (!genCache.has('d' + key)) genCache.set('d' + key, G.dailyPuzzle(key).level);
    return genCache.get('d' + key);
  }
  if (mode === 'endless') {
    if (PUZZLES.endless[key - 1]) return PUZZLES.endless[key - 1];
    if (!genCache.has('e' + key)) genCache.set('e' + key, G.endlessPuzzle(key).level);
    return genCache.get('e' + key);
  }
  return null;
}
// Replays moves [[blockIndex, dx], ...]. Returns true only if every move is
// legal and the red block reaches the exit exactly on the last move.
function replay(level, moves) {
  if (!Array.isArray(moves) || moves.length < 1 || moves.length > 500) return false;
  let bs = level.blocks.map(([x, y, w, t]) => ({ x, y, w, t }));
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    if (!Array.isArray(m) || m.length !== 2 || !Number.isInteger(m[0]) || !Number.isInteger(m[1])) return false;
    if (!C.moves(bs).some(([i, d]) => i === m[0] && d === m[1])) return false;
    bs = C.apply(bs, m);
    if (C.won(bs, level.exit) !== (k === moves.length - 1)) return false;
  }
  return true;
}

// --- http helpers ----------------------------------------------------------
function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(res.req),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 32768) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function userFrom(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
  return m ? db.prepare('SELECT * FROM users WHERE token_hash = ?').get(sha(m[1])) : null;
}
// Simple in-memory rate limit per IP and bucket.
const hits = new Map();
function limited(req, bucket, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = bucket + ':' + ip, now = Date.now();
  const h = (hits.get(k) || []).filter(t => now - t < windowMs);
  h.push(now); hits.set(k, h);
  return h.length > max;
}
setInterval(() => hits.clear(), 3600e3).unref();
function validDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  // Accept today and yesterday (Europe/Zagreb) so a puzzle started before midnight still counts.
  const now = new Date();
  return d === G.today(TZ, now) || d === G.today(TZ, new Date(now.getTime() - 864e5));
}

// --- leaderboards ----------------------------------------------------------
function board(mode, date, me) {
  let rows, mine = null;
  if (mode === 'daily') {
    const q = `SELECT u.name, d.moves, d.time_ms AS timeMs, d.stars, u.id,
               RANK() OVER (ORDER BY d.moves, d.time_ms) AS rank
               FROM daily d JOIN users u ON u.id = d.user_id WHERE d.date = ?`;
    rows = db.prepare(q + ' ORDER BY rank, d.updated_at LIMIT 50').all(date);
    if (me) mine = db.prepare(`SELECT * FROM (${q}) WHERE id = ?`).get(date, me.id) || null;
  } else if (mode === 'endless') {
    const q = `SELECT name, endless_next - 1 AS solved, endless_stars AS stars, id,
               RANK() OVER (ORDER BY endless_next DESC, endless_stars DESC) AS rank
               FROM users WHERE endless_next > 1`;
    rows = db.prepare(q + ' ORDER BY rank, created_at LIMIT 50').all();
    if (me) mine = db.prepare(`SELECT * FROM (${q}) WHERE id = ?`).get(me.id) || null;
  } else {
    const q = `SELECT u.name, SUM(c.stars) AS stars, COUNT(*) AS levels, SUM(c.moves) AS moves, u.id,
               RANK() OVER (ORDER BY SUM(c.stars) DESC, COUNT(*) DESC, SUM(c.moves)) AS rank
               FROM campaign c JOIN users u ON u.id = c.user_id GROUP BY u.id`;
    rows = db.prepare(q + ' ORDER BY rank LIMIT 50').all();
    if (me) mine = db.prepare(`SELECT * FROM (${q}) WHERE id = ?`).get(me.id) || null;
  }
  const strip = r => { if (!r) return r; const { id, ...rest } = r; return { ...rest, me: !!me && id === me.id }; };
  return { mode, date: date || null, rows: rows.map(strip), mine: strip(mine) };
}
function profile(u) {
  return {
    name: u.name,
    endless: { next: u.endless_next, stars: u.endless_stars },
    campaign: Object.fromEntries(db.prepare('SELECT level, stars FROM campaign WHERE user_id = ?').all(u.id).map(r => [r.level, r.stars])),
    daily: Object.fromEntries(db.prepare('SELECT date, moves FROM daily WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(u.id).map(r => [r.date, r.moves])),
  };
}

// --- routes ----------------------------------------------------------------
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, today: G.today(TZ) });

  if (req.method === 'POST' && p === '/api/register') {
    if (limited(req, 'reg', 10, 3600e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj kasnije.' });
    const { name } = await readJson(req);
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(n)) return send(res, 400, { error: 'Nadimak mora imati 2–16 znakova: slova, brojke, razmak, _ . -' });
    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(n)) return send(res, 409, { error: 'Taj nadimak je zauzet.' });
    const token = crypto.randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO users (name, token_hash, created_at) VALUES (?, ?, ?)').run(n, sha(token), Date.now());
    return send(res, 201, { name: n, token });
  }

  if (req.method === 'GET' && p === '/api/me') {
    const u = userFrom(req);
    return u ? send(res, 200, profile(u)) : send(res, 401, { error: 'Nisi prijavljen.' });
  }

  if (req.method === 'POST' && p === '/api/score') {
    const u = userFrom(req);
    if (!u) return send(res, 401, { error: 'Nisi prijavljen.' });
    if (limited(req, 'score', 120, 60e3)) return send(res, 429, { error: 'Previše zahtjeva.' });
    const { mode, level, date, n, moves, timeMs } = await readJson(req);
    const now = Date.now(), t = Math.max(0, Math.min(Number(timeMs) || 0, 864e5));
    let key;
    if (mode === 'campaign') key = Number(level);
    else if (mode === 'daily') { if (!validDate(date)) return send(res, 400, { error: 'Dnevna zagonetka je istekla.' }); key = date; }
    else if (mode === 'endless') {
      key = Number(n);
      if (!Number.isInteger(key) || key < 1 || key > u.endless_next) return send(res, 400, { error: 'Prvo riješi prethodne zagonetke.' });
    } else return send(res, 400, { error: 'Nepoznat način igre.' });
    const lv = puzzle(mode, key);
    if (!lv) return send(res, 404, { error: 'Nema te zagonetke.' });
    if (!replay(lv, moves)) return send(res, 422, { error: 'Rješenje nije ispravno.' });
    const m = moves.length, stars = starsFor(m, lv.opt);
    if (mode === 'campaign') {
      db.prepare(`INSERT INTO campaign (user_id, level, stars, moves, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, level) DO UPDATE SET stars = MAX(stars, excluded.stars), moves = MIN(moves, excluded.moves), updated_at = excluded.updated_at`)
        .run(u.id, key, stars, m, now);
    } else if (mode === 'daily') {
      db.prepare(`INSERT INTO daily (user_id, date, moves, time_ms, stars, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, date) DO UPDATE SET moves = excluded.moves, time_ms = excluded.time_ms, stars = excluded.stars, updated_at = excluded.updated_at
        WHERE excluded.moves < daily.moves OR (excluded.moves = daily.moves AND excluded.time_ms < daily.time_ms)`)
        .run(u.id, key, m, t, stars, now);
    } else {
      const prev = db.prepare('SELECT stars FROM endless WHERE user_id = ? AND n = ?').get(u.id, key);
      const gain = Math.max(0, stars - (prev ? prev.stars : 0));
      db.prepare(`INSERT INTO endless (user_id, n, stars, moves, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, n) DO UPDATE SET stars = MAX(stars, excluded.stars), moves = MIN(moves, excluded.moves), updated_at = excluded.updated_at`)
        .run(u.id, key, stars, m, now);
      db.prepare('UPDATE users SET endless_stars = endless_stars + ?, endless_next = MAX(endless_next, ?) WHERE id = ?').run(gain, key + 1, u.id);
    }
    const lb = board(mode, mode === 'daily' ? key : null, u);
    return send(res, 200, { ok: true, moves: m, stars, mine: lb.mine });
  }

  if (req.method === 'GET' && p === '/api/leaderboard') {
    const mode = url.searchParams.get('mode') || 'daily';
    if (!['daily', 'endless', 'campaign'].includes(mode)) return send(res, 400, { error: 'Nepoznat način igre.' });
    const date = mode === 'daily' ? (url.searchParams.get('date') || G.today(TZ)) : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'Neispravan datum.' });
    return send(res, 200, board(mode, date, userFrom(req)));
  }

  send(res, 404, { error: 'Nema te adrese.' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => { console.error(e); if (!res.headersSent) send(res, 400, { error: 'Neispravan zahtjev.' }); });
});
if (require.main === module) server.listen(PORT, () => console.log(`Topple API na http://localhost:${PORT}`));
module.exports = { server, replay, puzzle, db };
