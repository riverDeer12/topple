// End-to-end test of server/server.js on a temporary database. Run: npm run test:server
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'topple-')), 'test.db');
process.env.DB_PATH = dbFile;
const { server, setGoogleForTests } = require('../server/server.js');
const crypto = require('crypto');
const C = require('../web/core.js');
const G = require('../web/gen.js');
const LEVELS = require('../web/levels.js');
const PUZZLES = require('../web/puzzles.js');

// BFS that returns the optimal move list.
function solution(level) {
  const start = level.blocks.map(([x, y, w, t]) => ({ x, y, w, t }));
  const seen = new Set([C.key(start)]);
  let frontier = [[start, []]];
  while (frontier.length) {
    const next = [];
    for (const [s, path] of frontier) for (const m of C.moves(s)) {
      const n = C.apply(s, m), k = C.key(n);
      if (seen.has(k)) continue;
      if (C.won(n, level.exit)) return [...path, m];
      seen.add(k); next.push([n, [...path, m]]);
    }
    frontier = next;
  }
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, body, token) => {
    const res = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ok = (name) => console.log('ok   ' + name);

  let r = await call('/api/register', { name: 'Ana', password: 'tajna123', email: 'Ana@Example.com' });
  assert.strictEqual(r.status, 201); let ana = r.body.token; ok('register with password and e-mail');
  r = await call('/api/register', { name: 'ana', password: 'tajna123' }); assert.strictEqual(r.status, 409); ok('username unique, case-insensitive');
  r = await call('/api/register', { name: 'Ana2', password: 'tajna123', email: 'ana@example.com' }); assert.strictEqual(r.status, 409); ok('e-mail unique');
  r = await call('/api/register', { name: 'x', password: 'tajna123' }); assert.strictEqual(r.status, 400); ok('username validated');
  r = await call('/api/register', { name: 'Bez Lozinke' }); assert.strictEqual(r.status, 400); ok('password required');
  r = await call('/api/register', { name: 'Đuro Č', password: 'lozinka1' }); assert.strictEqual(r.status, 201); const duro = r.body.token; ok('Croatian letters allowed');
  r = await call('/api/me'); assert.strictEqual(r.status, 401); ok('auth required');

  r = await call('/api/login', { login: 'ana', password: 'tajna123' }); assert.strictEqual(r.status, 200); const ana2 = r.body.token;
  r = await call('/api/login', { login: 'ANA@example.com', password: 'tajna123' }); assert.strictEqual(r.status, 200);
  r = await call('/api/login', { login: 'Ana', password: 'kriva' }); assert.strictEqual(r.status, 401);
  ok('login by username or e-mail, wrong password rejected');
  r = await call('/api/me', null, ana2); assert.strictEqual(r.body.name, 'Ana'); assert.strictEqual(r.body.email, 'ana@example.com'); assert.strictEqual(r.body.hasPassword, true);
  r = await call('/api/logout', {}, ana2); r = await call('/api/me', null, ana2); assert.strictEqual(r.status, 401);
  r = await call('/api/me', null, ana); assert.strictEqual(r.status, 200); ok('sessions per device, logout ends only that one');

  r = await call('/api/account', { password: 'nova1234', currentPassword: 'kriva' }, ana); assert.strictEqual(r.status, 401);
  r = await call('/api/account', { password: 'nova1234', currentPassword: 'tajna123' }, ana); assert.strictEqual(r.status, 200);
  r = await call('/api/login', { login: 'Ana', password: 'nova1234' }); assert.strictEqual(r.status, 200);
  r = await call('/api/account', { email: 'duro@example.com' }, duro); assert.strictEqual(r.body.email, 'duro@example.com');
  r = await call('/api/account', { email: 'ana@example.com' }, duro); assert.strictEqual(r.status, 409);
  ok('account: change password (needs current one), set e-mail');

  // Google sign-in with a locally generated key standing in for Google's.
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  setGoogleForTests({ k1: publicKey }, 'test-client');
  const jwt = (claims, aud = 'test-client') => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud, exp: Date.now() / 1000 + 600, ...claims })).toString('base64url');
    return h + '.' + p + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), privateKey).toString('base64url');
  };
  r = await call('/api/config'); assert.strictEqual(r.body.googleClientId, 'test-client');
  r = await call('/api/google', { credential: jwt({ sub: 'g1', email: 'mia@gmail.com', email_verified: true, given_name: 'Mia' }) });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.body.name, 'Mia'); const mia = r.body.token;
  r = await call('/api/google', { credential: jwt({ sub: 'g1', email: 'mia@gmail.com', email_verified: true }) });
  assert.strictEqual(r.body.name, 'Mia'); assert.ok(r.body.token && !r.body.created);
  r = await call('/api/google', { credential: jwt({ sub: 'g2', email: 'x@gmail.com', email_verified: true, given_name: 'Mia' }) });
  assert.strictEqual(r.body.name, 'Mia2'); ok('Google: creates account, signs in again, unique name');
  r = await call('/api/google', { credential: jwt({ sub: 'g3', email: 'duro@example.com', email_verified: true }) });
  assert.strictEqual(r.body.name, 'Đuro Č'); ok('Google: verified e-mail joins the existing account');
  r = await call('/api/google', { credential: jwt({ sub: 'g4' }, 'other-client') }); assert.strictEqual(r.status, 401);
  r = await call('/api/google', { credential: jwt({ sub: 'g4' }).slice(0, -4) + 'AAAA' }); assert.strictEqual(r.status, 401);
  ok('Google: wrong audience or bad signature rejected');
  r = await call('/api/google', { credential: jwt({ sub: 'g5' }) }, ana); assert.strictEqual(r.body.linked, true);
  r = await call('/api/me', null, ana); assert.strictEqual(r.body.google, true);
  r = await call('/api/google', { credential: jwt({ sub: 'g1' }) }, ana); assert.strictEqual(r.status, 409);
  ok('Google: link to the signed-in account, not one owned by someone else');
  void mia;

  const sol1 = solution(LEVELS[0]);
  r = await call('/api/score', { mode: 'campaign', level: 1, moves: sol1 }, ana);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.stars, 3); ok('campaign score accepted');
  r = await call('/api/score', { mode: 'campaign', level: 1, moves: sol1.slice(0, -1) }, ana);
  assert.strictEqual(r.status, 422); ok('unfinished solution rejected');
  r = await call('/api/score', { mode: 'campaign', level: 1, moves: [[0, 99]] }, ana);
  assert.strictEqual(r.status, 422); ok('illegal move rejected');
  r = await call('/api/score', { mode: 'campaign', level: 2, moves: [...solution(LEVELS[1]), [0, 1]] }, ana);
  assert.strictEqual(r.status, 422); ok('moves after the win rejected');

  r = await call('/api/score', { mode: 'endless', n: 2, moves: solution(PUZZLES.endless[1]) }, ana);
  assert.strictEqual(r.status, 400); ok('endless must be solved in order');
  for (const n of [1, 2, 3]) {
    r = await call('/api/score', { mode: 'endless', n, moves: solution(PUZZLES.endless[n - 1]) }, ana);
    assert.strictEqual(r.status, 200);
  }
  r = await call('/api/me', null, ana);
  assert.deepStrictEqual(r.body.endless, { next: 4, stars: 9 }); ok('endless progress and stars');

  const today = G.today();
  const lv = PUZZLES.daily[today] || G.dailyPuzzle(today).level;
  const ds = solution(lv);
  r = await call('/api/score', { mode: 'daily', date: today, moves: ds, timeMs: 50000 }, ana); assert.strictEqual(r.status, 200);
  r = await call('/api/score', { mode: 'daily', date: today, moves: ds, timeMs: 20000 }, duro); assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.mine.rank, 1);
  r = await call('/api/score', { mode: 'daily', date: '2020-01-01', moves: ds }, ana); assert.strictEqual(r.status, 400);
  r = await call('/api/leaderboard?mode=daily&date=' + today, null, ana);
  assert.deepStrictEqual(r.body.rows.map(x => [x.name, x.rank, x.me]), [['Đuro Č', 1, false], ['Ana', 2, true]]);
  ok('daily leaderboard: fewest moves, then fastest');
  r = await call('/api/leaderboard?mode=endless');
  assert.strictEqual(r.body.rows[0].name, 'Ana'); assert.strictEqual(r.body.rows[0].solved, 3); ok('endless leaderboard');
  r = await call('/api/leaderboard?mode=campaign', null, duro);
  assert.strictEqual(r.body.rows[0].stars, 3); assert.strictEqual(r.body.mine, null); ok('campaign leaderboard');

  r = await call('/api/me', null, ana);
  assert.strictEqual(r.body.stats.levels, 1); assert.strictEqual(r.body.stats.stars, 3); assert.strictEqual(r.body.stats.endlessSolved, 3);
  assert.strictEqual(r.body.stats.dailySolved, 1); assert.deepStrictEqual(r.body.ranks, { daily: 2, endless: 1, campaign: 1 }); assert.ok(r.body.createdAt > 0);
  ok('profile: stats and ranks');
  r = await call('/api/account', { name: 'Đuro Č' }, ana); assert.strictEqual(r.status, 409);
  r = await call('/api/account', { name: 'x' }, ana); assert.strictEqual(r.status, 400);
  r = await call('/api/account', { name: '  Ana  Nova ' }, ana); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'Ana Nova');
  r = await call('/api/account', { name: 'ana nova' }, ana); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'ana nova');
  r = await call('/api/leaderboard?mode=daily&date=' + today, null, ana); assert.ok(r.body.rows.some(x => x.name === 'ana nova' && x.me));
  r = await call('/api/login', { login: 'ana nova', password: 'nova1234' }); assert.strictEqual(r.status, 200);
  ok('account: change username (unique, validated; own name in other case allowed), shown on leaderboards');

  r = await call('/api/me', null, ana); assert.strictEqual(r.body.skin, 'classic');
  r = await call('/api/account', { skin: 'cat' }, ana); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.code, 'skin_locked');
  r = await call('/api/account', { skin: 'unicorn' }, ana); assert.strictEqual(r.status, 400);
  r = await call('/api/score', { mode: 'campaign', level: 10, moves: solution(LEVELS[9]) }, ana); assert.strictEqual(r.status, 200);
  r = await call('/api/account', { skin: 'cat' }, ana); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.skin, 'cat');
  ok('skins: locked until level 10 is solved, then saved on the account');

  r = await call('/api/stats');
  assert.strictEqual(r.body.players, 4); assert.strictEqual(r.body.dailyToday, 2); assert.strictEqual(r.body.solved, 7); ok('stats');

  server.close();
  console.log('Svi testovi servera prolaze.');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
