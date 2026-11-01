// End-to-end test of server/server.js on a temporary database. Run: npm run test:server
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'topple-')), 'test.db');
process.env.DB_PATH = dbFile;
const { server } = require('../server/server.js');
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

  let r = await call('/api/register', { name: 'Ana' });
  assert.strictEqual(r.status, 201); const ana = r.body.token; ok('register');
  r = await call('/api/register', { name: 'ana' }); assert.strictEqual(r.status, 409); ok('nickname unique, case-insensitive');
  r = await call('/api/register', { name: 'x' }); assert.strictEqual(r.status, 400); ok('nickname validated');
  r = await call('/api/register', { name: 'Đuro Č' }); assert.strictEqual(r.status, 201); const duro = r.body.token; ok('Croatian letters allowed');
  r = await call('/api/me'); assert.strictEqual(r.status, 401); ok('auth required');

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

  r = await call('/api/stats');
  assert.strictEqual(r.body.players, 2); assert.strictEqual(r.body.dailyToday, 2); assert.strictEqual(r.body.solved, 6); ok('stats');

  server.close();
  console.log('Svi testovi servera prolaze.');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
