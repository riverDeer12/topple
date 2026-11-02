// Topple API: device accounts, verified scores and leaderboards.
// Plain Node.js (>= 22.5), no npm packages: node:http + node:sqlite.
// Every submitted solution is replayed with web/core.js before it is stored,
// so a score can only be recorded by actually solving the puzzle.
//
// Env: PORT (8787), HOST (127.0.0.1), DB_PATH (server/topple.db), TZ_GAME (Europe/Zagreb), GOOGLE_CLIENT_ID,
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

// --- accounts: sessions (one per signed-in device), passwords, Google -------------
// Schema v1 adds login methods and a sessions table. Older databases had one
// token per user in users.token_hash; those become the user's first session.
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  for (const c of ['email', 'password_hash', 'google_sub']) if (!cols.includes(c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} TEXT`);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email COLLATE NOCASE) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_google ON users (google_sub) WHERE google_sub IS NOT NULL;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO sessions (token_hash, user_id, created_at) SELECT token_hash, id, created_at FROM users;
    PRAGMA user_version = 1;
  `);
}
// Schema v2: chosen look of the red block.
if (db.prepare('PRAGMA user_version').get().user_version < 2) {
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'skin')) db.exec('ALTER TABLE users ADD COLUMN skin TEXT');
  db.exec('PRAGMA user_version = 2');
}
// Schema v3: anonymous guests (players without an account), to see how many people play.
// A guest is a random id made by the browser; no personal data. Linked to the account if
// the guest later signs up or signs in.
if (db.prepare('PRAGMA user_version').get().user_version < 3) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY, name TEXT, lang TEXT,
      first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, visits INTEGER NOT NULL DEFAULT 1,
      levels INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0,
      endless INTEGER NOT NULL DEFAULT 0, daily INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS guests_seen ON guests (last_seen);
    PRAGMA user_version = 3;
  `);
}
// Schema v4: when a player was last seen (for the admin page), and admin accounts.
// Admins are not players: their password hash is set on the server with
// `node server/admin.js set-admin <name> <password>`, never stored in the code.
if (db.prepare('PRAGMA user_version').get().user_version < 4) {
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'last_seen')) db.exec('ALTER TABLE users ADD COLUMN last_seen INTEGER');
  db.exec(`
    UPDATE users SET last_seen = MAX(created_at,
      COALESCE((SELECT MAX(updated_at) FROM campaign WHERE user_id = users.id), 0),
      COALESCE((SELECT MAX(updated_at) FROM daily WHERE user_id = users.id), 0),
      COALESCE((SELECT MAX(updated_at) FROM endless WHERE user_id = users.id), 0));
    CREATE TABLE IF NOT EXISTS admins (name TEXT PRIMARY KEY COLLATE NOCASE, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, admin TEXT NOT NULL, created_at INTEGER NOT NULL);
    PRAGMA user_version = 4;
  `);
}
const GUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
function linkGuest(guestId, userId) {
  if (typeof guestId === 'string' && GUEST_ID.test(guestId)) db.prepare('UPDATE guests SET user_id = ? WHERE id = ? AND user_id IS NULL').run(userId, guestId);
}
const SKINS = require('../web/content.js').SKINS;
function newSession(userId) {
  const token = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now());
  return token;
}
function createUser(name, fields = {}) {
  // users.token_hash is a legacy NOT NULL column; new accounts sign in through sessions.
  const r = db.prepare('INSERT INTO users (name, token_hash, created_at, email, password_hash, google_sub) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, sha(crypto.randomBytes(24).toString('base64url')), Date.now(), fields.email || null, fields.password_hash || null, fields.google_sub || null);
  return Number(r.lastInsertRowid);
}
const scrypt = (pw, salt) => crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('base64') + '$' + scrypt(pw, salt).toString('base64');
}
function checkPassword(pw, stored) {
  if (!stored || typeof pw !== 'string') return false;
  const [, salt, hash] = stored.split('$');
  const a = scrypt(pw, Buffer.from(salt, 'base64')), b = Buffer.from(hash, 'base64');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const cleanEmail = e => String(e || '').trim().toLowerCase();
const PW_ERR = 'Lozinka mora imati najmanje 6 znakova.';
const validPassword = pw => typeof pw === 'string' && pw.length >= 6 && pw.length <= 200;

// Google Sign-In: the browser gets an ID token (JWT) from Google; we check its
// signature with Google's public keys and that it was issued for our client ID.
let GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleKeys = null, googleKeysUntil = 0;
async function googleKey(kid) {
  if (!googleKeys || Date.now() > googleKeysUntil || !googleKeys[kid]) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    const { keys } = await res.json();
    const age = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
    googleKeys = Object.fromEntries(keys.map(k => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })]));
    googleKeysUntil = Date.now() + (age ? Number(age[1]) * 1000 : 3600e3);
  }
  return googleKeys[kid];
}
async function verifyGoogle(credential) {
  const parts = String(credential || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  let header, payload;
  try { header = JSON.parse(Buffer.from(h, 'base64url')); payload = JSON.parse(Buffer.from(p, 'base64url')); } catch (e) { return null; }
  if (header.alg !== 'RS256') return null;
  const key = await googleKey(header.kid);
  if (!key || !crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), key, Buffer.from(sig, 'base64url'))) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) return null;
  if (payload.aud !== GOOGLE_CLIENT_ID || !payload.sub || payload.exp * 1000 < Date.now()) return null;
  return payload;
}
// A free nickname based on the Google name: invalid characters dropped, number appended if taken.
function freeName(base) {
  let n = String(base || '').normalize('NFC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 14);
  if (!NAME_RE.test(n)) n = 'Igrač';
  for (let i = 1; ; i++) {
    const c = i === 1 ? n : (n.slice(0, 16 - String(i).length) + i);
    if (NAME_RE.test(c) && !db.prepare('SELECT 1 FROM users WHERE name = ?').get(c)) return c;
  }
}
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
  const u = m ? db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha(m[1])) : null;
  // Remember when the player was last here (at most one write per 5 minutes).
  if (u && !(u.last_seen > Date.now() - 5 * 60e3)) db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), u.id);
  return u;
}
const ADMIN_DAYS = 7;
function adminFrom(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = db.prepare('SELECT a.name, s.created_at FROM admin_sessions s JOIN admins a ON a.name = s.admin WHERE s.token_hash = ?').get(sha(m[1]));
  return s && s.created_at > Date.now() - ADMIN_DAYS * 864e5 ? s.name : null;
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
    email: u.email || null,
    hasPassword: !!u.password_hash,
    google: !!u.google_sub,
    endless: { next: u.endless_next, stars: u.endless_stars },
    campaign: Object.fromEntries(db.prepare('SELECT level, stars FROM campaign WHERE user_id = ?').all(u.id).map(r => [r.level, r.stars])),
    daily: Object.fromEntries(db.prepare('SELECT date, moves FROM daily WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(u.id).map(r => [r.date, r.moves])),
    createdAt: u.created_at,
    skin: u.skin || 'classic',
    stats: {
      levels: db.prepare('SELECT COUNT(*) AS n FROM campaign WHERE user_id = ?').get(u.id).n,
      stars: db.prepare('SELECT COALESCE(SUM(stars), 0) AS n FROM campaign WHERE user_id = ?').get(u.id).n,
      endlessSolved: u.endless_next - 1,
      endlessStars: u.endless_stars,
      dailySolved: db.prepare('SELECT COUNT(*) AS n FROM daily WHERE user_id = ?').get(u.id).n,
    },
    // Current place on each leaderboard (null when not on it).
    ranks: Object.fromEntries(['daily', 'endless', 'campaign'].map(m => {
      const mine = board(m, m === 'daily' ? G.today(TZ) : null, u).mine;
      return [m, mine ? mine.rank : null];
    })),
  };
}

// --- admin statistics ---------------------------------------------------------
function adminStats() {
  const now = Date.now(), since = d => now - d * 864e5, ONLINE = 15 * 60e3;
  const n = (q, ...a) => db.prepare(q).get(...a).n;
  const method = u => u.google_sub && u.password_hash ? 'both' : u.google_sub ? 'google' : u.password_hash ? 'password' : 'device';
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.password_hash, u.google_sub, u.created_at, u.last_seen, u.skin,
      u.endless_next - 1 AS endless, u.endless_stars,
      COALESCE(c.levels, 0) AS levels, COALESCE(c.stars, 0) AS stars, COALESCE(c.top, 0) AS top,
      (SELECT COUNT(*) FROM daily WHERE user_id = u.id) AS daily
    FROM users u LEFT JOIN (SELECT user_id, COUNT(*) AS levels, SUM(stars) AS stars, MAX(level) AS top FROM campaign GROUP BY user_id) c ON c.user_id = u.id`).all();
  const player = u => ({ name: u.name, method: method(u), createdAt: u.created_at, lastSeen: u.last_seen, top: u.top, levels: u.levels, stars: u.stars, endless: u.endless, daily: u.daily });

  // Activity per day (game time zone), last 14 days.
  const days = [];
  for (let i = 13; i >= 0; i--) days.push({ date: G.today(TZ, new Date(now - i * 864e5)), newUsers: 0, newGuests: 0, players: 0, daily: 0 });
  const byDate = Object.fromEntries(days.map(d => [d.date, d]));
  const dayOf = t => byDate[G.today(TZ, new Date(t))];
  const from = since(15);
  for (const r of db.prepare('SELECT created_at AS t FROM users WHERE created_at > ?').all(from)) { const d = dayOf(r.t); if (d) d.newUsers++; }
  for (const r of db.prepare('SELECT first_seen AS t FROM guests WHERE first_seen > ? AND user_id IS NULL').all(from)) { const d = dayOf(r.t); if (d) d.newGuests++; }
  const active = {};
  for (const r of db.prepare(`SELECT user_id AS u, updated_at AS t FROM campaign WHERE updated_at > ?1
      UNION ALL SELECT user_id, updated_at FROM daily WHERE updated_at > ?1 UNION ALL SELECT user_id, updated_at FROM endless WHERE updated_at > ?1`).all(from)) {
    const d = dayOf(r.t); if (d) (active[d.date] = active[d.date] || new Set()).add(r.u);
  }
  for (const d of days) { d.players = active[d.date] ? active[d.date].size : 0; d.daily = n('SELECT COUNT(*) AS n FROM daily WHERE date = ?', d.date); }

  // How many signed-in players solved each level, and how far guests got.
  const solvedBy = Object.fromEntries(db.prepare('SELECT level, COUNT(*) AS c FROM campaign GROUP BY level').all().map(r => [r.level, r.c]));
  const levels = LEVELS.map((lv, i) => ({ level: i + 1, players: solvedBy[i + 1] || 0 }));
  const guestLevels = db.prepare('SELECT levels, COUNT(*) AS c FROM guests WHERE user_id IS NULL GROUP BY levels ORDER BY levels').all().map(r => ({ levels: r.levels, guests: r.c }));
  const count = (rows, key) => Object.entries(rows.reduce((m, r) => { const k = key(r) || '?'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const guestRows = db.prepare('SELECT lang FROM guests WHERE user_id IS NULL').all();

  return {
    now, today: G.today(TZ), levelCount: LEVELS.length,
    online: { users: users.filter(u => u.last_seen > now - ONLINE).length, guests: n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL AND last_seen > ?', now - ONLINE) },
    totals: {
      users: users.length,
      guests: n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL'),
      converted: n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NOT NULL'),
      campaign: n('SELECT COUNT(*) AS n FROM campaign'), daily: n('SELECT COUNT(*) AS n FROM daily'), endless: n('SELECT COUNT(*) AS n FROM endless'),
      guestVisits: n('SELECT COALESCE(SUM(visits), 0) AS n FROM guests'),
    },
    windows: [1, 7, 30].map(d => ({
      days: d,
      activeUsers: users.filter(u => u.last_seen > since(d)).length,
      newUsers: users.filter(u => u.created_at > since(d)).length,
      activeGuests: n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL AND last_seen > ?', since(d)),
      newGuests: n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL AND first_seen > ?', since(d)),
    })),
    days, levels, guestLevels,
    top: users.filter(u => u.levels || u.endless || u.daily)
      .sort((a, b) => b.top - a.top || b.stars - a.stars || b.endless - a.endless || b.daily - a.daily).slice(0, 20).map(player),
    methods: count(users, method), skins: count(users, u => u.skin || 'classic'), langs: count(guestRows, r => r.lang),
    recentUsers: users.sort((a, b) => b.created_at - a.created_at).slice(0, 15).map(player),
    recentGuests: db.prepare(`SELECT name, lang, first_seen AS firstSeen, last_seen AS lastSeen, visits, levels, stars, endless, daily
      FROM guests WHERE user_id IS NULL ORDER BY last_seen DESC LIMIT 15`).all(),
  };
}

// --- routes ----------------------------------------------------------------
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true, today: G.today(TZ) });
  // A guest reports its progress (fire-and-forget from the game).
  if (req.method === 'POST' && p === '/api/guest') {
    if (limited(req, 'guest', 60, 60e3)) return send(res, 429, { error: 'Previše zahtjeva.', code: 'too_many' });
    const b = await readJson(req);
    if (typeof b.id !== 'string' || !GUEST_ID.test(b.id)) return send(res, 400, { error: 'Neispravan zahtjev.', code: 'bad_request' });
    const num = v => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
    const name = String(b.name || '').slice(0, 40), lang = ['hr', 'en', 'it', 'de'].includes(b.lang) ? b.lang : null, now = Date.now();
    const old = db.prepare('SELECT last_seen FROM guests WHERE id = ?').get(b.id);
    if (!old) {
      db.prepare('INSERT INTO guests (id, name, lang, first_seen, last_seen, levels, stars, endless, daily) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(b.id, name, lang, now, now, num(b.levels), num(b.stars), num(b.endless), num(b.daily));
    } else {
      // A new visit = back after at least 30 minutes away.
      db.prepare(`UPDATE guests SET name = ?, lang = ?, last_seen = ?, visits = visits + ?,
        levels = MAX(levels, ?), stars = MAX(stars, ?), endless = MAX(endless, ?), daily = MAX(daily, ?) WHERE id = ?`)
        .run(name, lang, now, now - old.last_seen > 30 * 60e3 ? 1 : 0, num(b.levels), num(b.stars), num(b.endless), num(b.daily), b.id);
    }
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && p === '/api/stats') {
    const today = G.today(TZ);
    return send(res, 200, {
      players: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      guests: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL').get().n,
      activeWeek: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NULL AND last_seen > ?').get(Date.now() - 7 * 864e5).n,
      dailyToday: db.prepare('SELECT COUNT(*) AS n FROM daily WHERE date = ?').get(today).n,
      solved: db.prepare('SELECT (SELECT COUNT(*) FROM campaign) + (SELECT COUNT(*) FROM daily) + (SELECT COUNT(*) FROM endless) AS n').get().n,
      today,
    });
  }

  // Admin page (web/admin/): sign in, sign out, statistics.
  if (req.method === 'POST' && p === '/api/admin/login') {
    if (limited(req, 'admin', 10, 15 * 60e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj za 15 minuta.', code: 'too_many_15' });
    const { user, password } = await readJson(req);
    const a = db.prepare('SELECT * FROM admins WHERE name = ?').get(String(user || '').trim());
    if (!a || !checkPassword(password, a.password_hash)) return send(res, 401, { error: 'Pogrešno ime ili lozinka.', code: 'bad_login' });
    db.prepare('DELETE FROM admin_sessions WHERE created_at < ?').run(Date.now() - ADMIN_DAYS * 864e5);
    const token = crypto.randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO admin_sessions (token_hash, admin, created_at) VALUES (?, ?, ?)').run(sha(token), a.name, Date.now());
    return send(res, 200, { name: a.name, token });
  }
  if (req.method === 'POST' && p === '/api/admin/logout') {
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
    if (m) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha(m[1]));
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && p === '/api/admin/stats') {
    const admin = adminFrom(req);
    if (!admin) return send(res, 401, { error: 'Nisi prijavljen.', code: 'not_signed_in' });
    return send(res, 200, { admin, ...adminStats() });
  }

  if (req.method === 'GET' && p === '/api/config') return send(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null });

  // New account: nickname + password, e-mail optional (then it can be used to sign in too).
  if (req.method === 'POST' && p === '/api/register') {
    if (limited(req, 'reg', 10, 3600e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj kasnije.', code: 'too_many' });
    const { name, password, email, guest } = await readJson(req);
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(n)) return send(res, 400, { error: 'Korisničko ime mora imati 2–16 znakova: slova, brojke, razmak, _ . -', code: 'name_invalid' });
    if (!validPassword(password)) return send(res, 400, { error: PW_ERR, code: 'password_short' });
    const e = cleanEmail(email);
    if (e && !EMAIL_RE.test(e)) return send(res, 400, { error: 'E-mail adresa nije ispravna.', code: 'email_invalid' });
    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(n)) return send(res, 409, { error: 'To korisničko ime je zauzeto.', code: 'name_taken' });
    if (e && db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) return send(res, 409, { error: 'Taj e-mail već ima račun. Prijavi se.', code: 'email_taken' });
    const id = createUser(n, { email: e || null, password_hash: hashPassword(password) });
    linkGuest(guest, id);
    return send(res, 201, { name: n, token: newSession(id) });
  }

  // Sign in with username or e-mail and password.
  if (req.method === 'POST' && p === '/api/login') {
    if (limited(req, 'login', 20, 15 * 60e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj za 15 minuta.', code: 'too_many_15' });
    const { login, password, guest } = await readJson(req);
    const l = String(login || '').trim();
    const u = l.includes('@') ? db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail(l)) : db.prepare('SELECT * FROM users WHERE name = ?').get(l);
    if (!u || !checkPassword(password, u.password_hash)) return send(res, 401, { error: 'Pogrešno korisničko ime, e-mail ili lozinka.', code: 'bad_login' });
    linkGuest(guest, u.id);
    return send(res, 200, { name: u.name, token: newSession(u.id) });
  }

  // Google: signs in, creates an account, or (when already signed in) links Google to this account.
  if (req.method === 'POST' && p === '/api/google') {
    if (!GOOGLE_CLIENT_ID) return send(res, 503, { error: 'Prijava s Googleom nije postavljena.', code: 'google_off' });
    if (limited(req, 'login', 20, 15 * 60e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj za 15 minuta.', code: 'too_many_15' });
    const { credential, guest } = await readJson(req);
    const g = await verifyGoogle(credential);
    if (!g) return send(res, 401, { error: 'Google prijava nije uspjela.', code: 'google_failed' });
    const email = g.email_verified ? cleanEmail(g.email) : '';
    const me = userFrom(req), owner = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(g.sub);
    if (me) {
      if (owner && owner.id !== me.id) return send(res, 409, { error: 'Taj Google račun je već povezan s drugim igračem.', code: 'google_taken' });
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(g.sub, me.id);
      if (email && !me.email && !db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, me.id);
      return send(res, 200, { name: me.name, linked: true });
    }
    if (owner) { linkGuest(guest, owner.id); return send(res, 200, { name: owner.name, token: newSession(owner.id) }); }
    const byEmail = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (byEmail) { // same verified e-mail: this is the same person
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(g.sub, byEmail.id);
      linkGuest(guest, byEmail.id);
      return send(res, 200, { name: byEmail.name, token: newSession(byEmail.id) });
    }
    const name = freeName(g.given_name || g.name || email.split('@')[0]);
    const id = createUser(name, { email: email || null, google_sub: g.sub });
    linkGuest(guest, id);
    return send(res, 201, { name, token: newSession(id), created: true });
  }

  if (req.method === 'POST' && p === '/api/logout') {
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
    return send(res, 200, { ok: true });
  }

  // Account settings: add or change password and e-mail. Changing an existing password needs the current one.
  if (req.method === 'POST' && p === '/api/account') {
    const u = userFrom(req);
    if (!u) return send(res, 401, { error: 'Nisi prijavljen.', code: 'not_signed_in' });
    if (limited(req, 'account', 30, 15 * 60e3)) return send(res, 429, { error: 'Previše pokušaja, pokušaj za 15 minuta.', code: 'too_many_15' });
    const { password, currentPassword, email, name, skin } = await readJson(req);
    if (skin !== undefined) {
      const sk = SKINS.find(x => x.id === skin);
      if (!sk) return send(res, 400, { error: 'Nepoznat izgled.', code: 'skin_unknown' });
      if (sk.level && !db.prepare('SELECT 1 FROM campaign WHERE user_id = ? AND level = ?').get(u.id, sk.level)) return send(res, 403, { error: 'Taj izgled još nije otključan.', code: 'skin_locked' });
      db.prepare('UPDATE users SET skin = ? WHERE id = ?').run(sk.id, u.id);
    }
    if (name !== undefined) {
      const n = String(name || '').trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(n)) return send(res, 400, { error: 'Korisničko ime mora imati 2–16 znakova: slova, brojke, razmak, _ . -', code: 'name_invalid' });
      if (db.prepare('SELECT 1 FROM users WHERE name = ? AND id <> ?').get(n, u.id)) return send(res, 409, { error: 'To korisničko ime je zauzeto.', code: 'name_taken' });
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(n, u.id);
    }
    if (password !== undefined) {
      if (!validPassword(password)) return send(res, 400, { error: PW_ERR, code: 'password_short' });
      if (u.password_hash && !checkPassword(currentPassword, u.password_hash)) return send(res, 401, { error: 'Trenutna lozinka nije točna.', code: 'current_password' });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
    }
    if (email !== undefined) {
      const e = cleanEmail(email);
      if (e && !EMAIL_RE.test(e)) return send(res, 400, { error: 'E-mail adresa nije ispravna.', code: 'email_invalid' });
      if (e && db.prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?').get(e, u.id)) return send(res, 409, { error: 'Taj e-mail već koristi drugi račun.', code: 'email_in_use' });
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(e || null, u.id);
    }
    return send(res, 200, profile(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
  }

  if (req.method === 'GET' && p === '/api/me') {
    const u = userFrom(req);
    return u ? send(res, 200, profile(u)) : send(res, 401, { error: 'Nisi prijavljen.', code: 'not_signed_in' });
  }

  if (req.method === 'POST' && p === '/api/score') {
    const u = userFrom(req);
    if (!u) return send(res, 401, { error: 'Nisi prijavljen.', code: 'not_signed_in' });
    if (limited(req, 'score', 120, 60e3)) return send(res, 429, { error: 'Previše zahtjeva.', code: 'too_many' });
    const { mode, level, date, n, moves, timeMs } = await readJson(req);
    const now = Date.now(), t = Math.max(0, Math.min(Number(timeMs) || 0, 864e5));
    let key;
    if (mode === 'campaign') key = Number(level);
    else if (mode === 'daily') { if (!validDate(date)) return send(res, 400, { error: 'Dnevna zagonetka je istekla.', code: 'daily_expired' }); key = date; }
    else if (mode === 'endless') {
      key = Number(n);
      if (!Number.isInteger(key) || key < 1 || key > u.endless_next) return send(res, 400, { error: 'Prvo riješi prethodne zagonetke.', code: 'endless_order' });
    } else return send(res, 400, { error: 'Nepoznat način igre.', code: 'bad_mode' });
    const lv = puzzle(mode, key);
    if (!lv) return send(res, 404, { error: 'Nema te zagonetke.', code: 'no_puzzle' });
    if (!replay(lv, moves)) return send(res, 422, { error: 'Rješenje nije ispravno.', code: 'bad_solution' });
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
    if (!['daily', 'endless', 'campaign'].includes(mode)) return send(res, 400, { error: 'Nepoznat način igre.', code: 'bad_mode' });
    const date = mode === 'daily' ? (url.searchParams.get('date') || G.today(TZ)) : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'Neispravan datum.', code: 'bad_date' });
    return send(res, 200, board(mode, date, userFrom(req)));
  }

  send(res, 404, { error: 'Nema te adrese.', code: 'not_found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => { console.error(e); if (!res.headersSent) send(res, 400, { error: 'Neispravan zahtjev.', code: 'bad_request' }); });
});
// Listens on localhost only by default: nginx in front of it handles the public HTTPS traffic.
const HOST = process.env.HOST || '127.0.0.1';
if (require.main === module) server.listen(PORT, HOST, () => console.log(`Topple API na http://${HOST}:${PORT}`));
// Test hook: use local keys and client ID instead of Google's.
function setGoogleForTests(keys, clientId) { googleKeys = keys; googleKeysUntil = Infinity; GOOGLE_CLIENT_ID = clientId; }
module.exports = { server, replay, puzzle, db, setGoogleForTests, hashPassword, checkPassword, EMAIL_RE, cleanEmail, validPassword };
