// End-to-end test of server/server.js on a temporary database. Run: npm run test:server
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'topple-')), 'test.db');
process.env.DB_PATH = dbFile;
const { server, setGoogleForTests, setAppleForTests } = require('../server/server.js');
const crypto = require('crypto');
const C = require('../web/core.js');
const G = require('../web/gen.js');
const LEVELS = require('../web/levels.js');
const PUZZLES = require('../web/puzzles.js');

// BFS that returns the optimal move list.
function solution(level) {
  const start = C.fromLevel(level.blocks);
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

  const gid = 'guest_' + 'x'.repeat(20);
  r = await call('/api/guest', { id: gid, name: 'Pospani Pingvin 17', lang: 'hr', levels: 4, stars: 10, endless: 1, daily: 0 }); assert.strictEqual(r.status, 200);
  r = await call('/api/guest', { id: gid, name: 'Pospani Pingvin 17', lang: 'hr', levels: 2, stars: 12 }); assert.strictEqual(r.status, 200);
  r = await call('/api/guest', { id: 'short' }); assert.strictEqual(r.status, 400);
  const { db: sdb } = require('../server/server.js');
  let gr = sdb.prepare('SELECT * FROM guests WHERE id = ?').get(gid);
  assert.strictEqual(gr.levels, 4); assert.strictEqual(gr.stars, 12); assert.strictEqual(gr.visits, 1);
  r = await call('/api/stats'); assert.strictEqual(r.body.guests, 1); assert.strictEqual(r.body.activeWeek, 1);
  r = await call('/api/register', { name: 'Bivsi Gost', password: 'lozinka1', guest: gid }); assert.strictEqual(r.status, 201);
  gr = sdb.prepare('SELECT user_id FROM guests WHERE id = ?').get(gid); assert.ok(gr.user_id);
  ok('guests: progress stored (never lowered), linked to the account on sign-up');

  r = await call('/api/stats');
  assert.strictEqual(r.body.players, 5); assert.strictEqual(r.body.dailyToday, 2); assert.strictEqual(r.body.solved, 7); assert.ok(r.body.online >= 1); ok('stats');

  // Forgotten password, with a fake SMTP server that keeps the messages.
  r = await call('/api/forgot', { login: 'x' }); assert.strictEqual(r.status, 503);
  const mails = [];
  const smtp = require('net').createServer(sock => {
    let data = false, msg = '';
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', d => {
      for (const line of d.toString().split('\r\n').filter((l, i, a) => i < a.length - 1 || l)) {
        if (data) { if (line === '.') { data = false; mails.push(msg); sock.write('250 ok\r\n'); } else msg += line + '\n'; continue; }
        if (/^EHLO/.test(line)) sock.write('250-fake\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH PLAIN/.test(line)) sock.write('235 ok\r\n');
        else if (/^DATA/.test(line)) { data = true; msg = ''; sock.write('354 go\r\n'); }
        else if (/^QUIT/.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 ok\r\n');
      }
    });
  });
  await new Promise(ok => smtp.listen(0, '127.0.0.1', ok));
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Topple <info@example.com>', SMTP_TLS: 'off' });
  r = await call('/api/config'); assert.strictEqual(r.body.passwordReset, true);
  r = await call('/api/register', { name: 'Zaboravko', password: 'stara123', email: 'zab@example.com' }); assert.strictEqual(r.status, 201);
  const oldToken = r.body.token;
  r = await call('/api/forgot', { login: 'nitko@example.com' }); assert.strictEqual(r.status, 200);
  r = await call('/api/forgot', { login: 'zab@example.com', lang: 'en' }); assert.strictEqual(r.status, 200);
  for (let k = 0; k < 50 && mails.length < 1; k++) await new Promise(ok => setTimeout(ok, 20));
  assert.strictEqual(mails.length, 1, 'only the existing account gets an e-mail');
  const body = Buffer.from(mails[0].split('\n\n').slice(1).join('').replace(/\s+/g, ''), 'base64').toString('utf8');
  assert.ok(mails[0].includes('To: zab@example.com') && body.includes('Hi Zaboravko'));
  const resetToken = /#reset=([A-Za-z0-9_-]+)/.exec(body)[1];
  r = await call('/api/reset', { token: resetToken, password: 'x' }); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.code, 'password_short');
  r = await call('/api/reset', { token: resetToken, password: 'nova12345' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'Zaboravko');
  r = await call('/api/me', null, oldToken); assert.strictEqual(r.status, 401, 'other devices are signed out');
  r = await call('/api/reset', { token: resetToken, password: 'nova12345' }); assert.strictEqual(r.body.code, 'reset_expired');
  r = await call('/api/login', { login: 'Zaboravko', password: 'nova12345' }); assert.strictEqual(r.status, 200);
  smtp.close();
  ok('forgotten password: e-mail with a one-time link, new password, other sessions end');

  // Friends: add by username, leaderboard with just them.
  r = await call('/api/friends'); assert.strictEqual(r.status, 401);
  r = await call('/api/friends', null, ana); assert.deepStrictEqual(r.body.friends, []);
  r = await call('/api/friends', { add: 'nitko-takav' }, ana); assert.strictEqual(r.body.code, 'friend_unknown');
  const me = (await call('/api/me', null, ana)).body.name;
  r = await call('/api/friends', { add: me }, ana); assert.strictEqual(r.body.code, 'friend_self');
  r = await call('/api/friends', { add: 'Đuro Č' }, ana); assert.deepStrictEqual(r.body.friends, ['Đuro Č']);
  for (const m of ['daily', 'endless', 'campaign']) {
    const all = (await call('/api/leaderboard?mode=' + m, null, ana)).body, fr = (await call('/api/leaderboard?mode=' + m + '&friends=1', null, ana)).body;
    assert.ok(fr.friends && fr.rows.every(x => x.me || x.name === 'Đuro Č'), m + ': only friends');
    assert.ok(fr.rows.length <= 2 && (!fr.rows.length || fr.rows[0].rank === 1), m + ': ranked among friends');
    if (all.mine) assert.ok(fr.mine && fr.mine.rank <= all.mine.rank);
  }
  r = await call('/api/leaderboard?mode=daily&friends=1'); assert.strictEqual(r.status, 401);
  r = await call('/api/friends', { remove: 'Đuro Č' }, ana); assert.deepStrictEqual(r.body.friends, []);
  ok('friends: add, friends leaderboard, remove');

  // Daily reminder: subscribe, the server sends an encrypted push with a VAPID signature.
  const pushes = [];
  const pushSrv = require('http').createServer((q, res) => { const parts = []; q.on('data', d => parts.push(d)); q.on('end', () => { pushes.push({ url: q.url, headers: q.headers, body: Buffer.concat(parts) }); res.writeHead(q.url.includes('gone') ? 410 : 201); res.end(); }); });
  await new Promise(okk => pushSrv.listen(0, '127.0.0.1', okk));
  process.env.PUSH_TEST_PREFIX = `http://127.0.0.1:${pushSrv.address().port}/`;
  const browser = crypto.createECDH('prime256v1'); browser.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const sub = { endpoint: process.env.PUSH_TEST_PREFIX + 'sub1', keys: { p256dh: browser.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') } };
  r = await call('/api/config'); const pushKey = r.body.pushKey; assert.ok(/^[A-Za-z0-9_-]{87}$/.test(pushKey));
  r = await call('/api/push/subscribe', { sub: { ...sub, endpoint: 'https://evil.example.com/x' } }); assert.strictEqual(r.status, 400, 'only push services');
  r = await call('/api/push/subscribe', { sub, lang: 'en', guest: gid }); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  r = await call('/api/push/subscribe', { sub: { ...sub, endpoint: process.env.PUSH_TEST_PREFIX + 'gone' }, lang: 'hr' }); assert.strictEqual(r.status, 200);
  const { sendReminders, db: pdb } = require('../server/server.js');
  const yest = require('../web/gen.js').today('Europe/Zagreb', new Date(Date.now() - 864e5));
  r = await call('/api/push/solved', { endpoint: sub.endpoint, date: yest, streak: 4 }); assert.strictEqual(r.status, 200);
  const evening = new Date(); evening.setUTCHours(20, 0, 0, 0);
  assert.strictEqual(await sendReminders(new Date(evening.getTime() - 15 * 3600e3)), 0, 'not before the reminder hour');
  assert.strictEqual(await sendReminders(evening), 1);
  assert.strictEqual(pushes.length, 2);
  assert.ok(!pdb.prepare('SELECT 1 FROM push_subs WHERE endpoint LIKE ?').get('%gone'), 'expired subscription removed');
  const pm = pushes.find(x => x.url === '/sub1');
  // VAPID: ES256 JWT for the push service origin, signed with the server's key.
  const [, vjwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(pm.headers.authorization);
  assert.strictEqual(k, pushKey);
  const [h64, c64, s64] = vjwt.split('.'), pub = Buffer.from(k, 'base64url');
  const verifyKey = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
  assert.ok(crypto.verify('sha256', Buffer.from(h64 + '.' + c64), { key: verifyKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s64, 'base64url')));
  assert.strictEqual(JSON.parse(Buffer.from(c64, 'base64url')).aud, process.env.PUSH_TEST_PREFIX.slice(0, -1));
  // Decrypt like a browser would (RFC 8291).
  const bd = pm.body, salt = bd.subarray(0, 16), asPub = bd.subarray(21, 86), hm = (a, b) => crypto.createHmac('sha256', a).update(b).digest();
  const ikm = hm(hm(authSecret, browser.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), browser.getPublicKey(), asPub, Buffer.from([1])]));
  const prk = hm(salt, ikm);
  const dc = crypto.createDecipheriv('aes-128-gcm', hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), hm(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12));
  dc.setAuthTag(bd.subarray(bd.length - 16));
  const plain = Buffer.concat([dc.update(bd.subarray(86, bd.length - 16)), dc.final()]);
  const msg = JSON.parse(plain.subarray(0, plain.length - 1).toString());
  assert.ok(msg.title.includes('daily') && msg.body.includes('4'), 'English reminder with the streak');
  assert.strictEqual(await sendReminders(evening), 0, 'once a day');
  r = await call('/api/push/unsubscribe', { endpoint: sub.endpoint }); assert.strictEqual(r.status, 200);
  pushSrv.close();
  ok('reminders: subscribe, encrypted VAPID push once a day, expired ones removed');

  // Level plays for difficulty tuning: attempts until the first solve, then the first solve's details.
  const pg = 'guest_' + 'p'.repeat(20);
  for (const kind of ['start', 'start', 'solve', 'start', 'solve']) {
    r = await call('/api/play', { kind, level: 3, guest: pg, moves: kind === 'solve' ? LEVELS[2].opt + 2 : 0, timeMs: 61000, hints: 1 }); assert.strictEqual(r.status, 200);
  }
  r = await call('/api/play', { kind: 'start', level: 3 }); assert.strictEqual(r.status, 400, 'needs an account or a guest id');
  r = await call('/api/play', { kind: 'start', level: 9999, guest: pg }); assert.strictEqual(r.status, 400);
  r = await call('/api/play', { kind: 'start', level: 3 }, ana); assert.strictEqual(r.status, 200);
  ok('plays: attempts and first solve per player and level');

  // Account deletion from the game (App Store rule): password needed, then everything is gone.
  r = await call('/api/register', { name: 'Brisko', password: 'brisi123' }); const bt = r.body.token;
  await call('/api/score', { mode: 'campaign', level: 1, moves: solution(LEVELS[0]) }, bt);
  r = await call('/api/account/delete', { password: 'kriva' }, bt); assert.strictEqual(r.status, 401);
  r = await call('/api/account/delete', { password: 'brisi123' }, bt); assert.strictEqual(r.status, 200);
  r = await call('/api/me', null, bt); assert.strictEqual(r.status, 401);
  r = await call('/api/login', { login: 'Brisko', password: 'brisi123' }); assert.strictEqual(r.status, 401);
  ok('account deletion: needs the password, removes the player');

  // Sign in with Apple (iOS app): token for the app's bundle ID; the name comes from the app.
  const ak = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  setAppleForTests({ a1: ak.publicKey }, 'software.rdd.topple');
  const ajwt = (claims, aud = 'software.rdd.topple') => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'a1' })).toString('base64url');
    const pl = Buffer.from(JSON.stringify({ iss: 'https://appleid.apple.com', aud, exp: Date.now() / 1000 + 600, ...claims })).toString('base64url');
    return h + '.' + pl + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + pl), ak.privateKey).toString('base64url');
  };
  r = await call('/api/apple', { identityToken: ajwt({ sub: 'ap1', email: 'x@privaterelay.appleid.com', email_verified: 'true' }, 'other.app') }); assert.strictEqual(r.status, 401);
  r = await call('/api/apple', { identityToken: ajwt({ sub: 'ap1', email: 'x@privaterelay.appleid.com', email_verified: 'true' }), name: 'Luka' });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.body.name, 'Luka');
  r = await call('/api/apple', { identityToken: ajwt({ sub: 'ap1' }) }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'Luka');
  ok('Sign in with Apple: creates the account once, then signs in');

  // Apple token revocation: the sign-in code becomes a refresh token, revoked on account deletion.
  const appleCalls = [];
  const appleSrv = require('http').createServer((q, res) => { let b = ''; q.on('data', d => { b += d; }); q.on('end', () => {
    appleCalls.push({ url: q.url, form: Object.fromEntries(new URLSearchParams(b)) });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(q.url === '/auth/token' ? JSON.stringify({ refresh_token: 'rt-123', id_token: 'x' }) : '');
  }); });
  await new Promise(okk => appleSrv.listen(0, '127.0.0.1', okk));
  process.env.APPLE_AUTH_URL = `http://127.0.0.1:${appleSrv.address().port}`;
  const appleMod = require('../server/apple.js');
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  require('fs').writeFileSync(appleMod.configFile(), JSON.stringify({ teamId: 'TEAM123456', keyId: 'KEY1234567', key: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
  const secret = appleMod.clientSecret(appleMod.config(), 'software.rdd.topple');
  const [sh, sp, ss] = secret.split('.');
  assert.ok(crypto.verify('sha256', Buffer.from(sh + '.' + sp), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(ss, 'base64url')), 'client secret signed with the .p8 key');
  assert.deepStrictEqual([JSON.parse(Buffer.from(sh, 'base64url')).kid, JSON.parse(Buffer.from(sp, 'base64url')).iss], ['KEY1234567', 'TEAM123456']);
  const { db: adb } = require('../server/server.js');
  adb.prepare("UPDATE users SET apple_refresh = 'rt-123' WHERE apple_sub = 'ap1'").run();
  const apr = await call('/api/apple', { identityToken: ajwt({ sub: 'ap1' }) });
  r = await call('/api/account/delete', { confirm: 'Luka' }, apr.body.token); assert.strictEqual(r.status, 200);
  for (let k = 0; k < 50 && !appleCalls.some(c => c.url === '/auth/revoke'); k++) await new Promise(okk => setTimeout(okk, 20));
  const rv = appleCalls.find(c => c.url === '/auth/revoke');
  assert.ok(rv && rv.form.token === 'rt-123' && rv.form.client_id === 'software.rdd.topple' && rv.form.token_type_hint === 'refresh_token', 'revoked at Apple');
  r = await call('/api/apple', { identityToken: ajwt({ sub: 'ap2', email: 'n@example.com', email_verified: true }), code: 'c-1', name: 'Nora' }); assert.strictEqual(r.status, 201);
  for (let k = 0; k < 50 && !adb.prepare("SELECT apple_refresh FROM users WHERE apple_sub = 'ap2'").get().apple_refresh; k++) await new Promise(okk => setTimeout(okk, 20));
  assert.strictEqual(adb.prepare("SELECT apple_refresh FROM users WHERE apple_sub = 'ap2'").get().apple_refresh, 'rt-123', 'code exchanged for a refresh token');
  assert.strictEqual(appleCalls.find(c => c.url === '/auth/token').form.code, 'c-1');
  appleSrv.close();
  ok('Apple: code exchanged at sign-in, sign-in revoked when the account is deleted');

  for (const kind of ['shop', 'viewed', 'shop', 'sim']) { r = await call('/api/ad', { kind, guest: pg }); assert.strictEqual(r.status, 200); }
  r = await call('/api/ad', { kind: 'bogus' }); assert.strictEqual(r.status, 400);
  ok('ad events recorded');

  r = await call('/api/admin/stats'); assert.strictEqual(r.status, 401);
  r = await call('/api/admin/login', { user: 'Boss', password: 'dugaLozinka!1' }); assert.strictEqual(r.status, 401);
  r = await call('/api/admin/stats', null, ana); assert.strictEqual(r.status, 401);
  sdb.prepare('INSERT INTO admins (name, password_hash) VALUES (?, ?)').run('Boss', require('../server/server.js').hashPassword('dugaLozinka!1'));
  r = await call('/api/admin/login', { user: 'boss', password: 'kriva' }); assert.strictEqual(r.status, 401);
  r = await call('/api/admin/login', { user: 'boss', password: 'dugaLozinka!1' }); assert.strictEqual(r.status, 200);
  const adm = r.body.token;
  r = await call('/api/admin/stats', null, adm); assert.strictEqual(r.status, 200);
  const st = r.body;
  assert.strictEqual(st.totals.users, 7); assert.strictEqual(st.totals.converted, 1); assert.strictEqual(st.totals.guests, 0);
  assert.ok(st.online.users >= 1); assert.strictEqual(st.days.length, 14); assert.strictEqual(st.days[13].date, st.today);
  assert.ok(st.days[13].players >= 2); assert.strictEqual(st.days[13].daily, 2); assert.strictEqual(st.days[13].newUsers, 7);
  assert.strictEqual(st.levels.length, LEVELS.length); assert.strictEqual(st.levels[9].players, 1);
  const d3 = st.difficulty[2];
  assert.deepStrictEqual([d3.started, d3.solved, d3.attempts, d3.hints, d3.extraMoves, d3.medianTimeS, d3.perfect], [2, 1, 2, 1, 2, 61, 0]);
  assert.strictEqual(st.difficulty.length, LEVELS.length);
  assert.deepStrictEqual([st.ads.shop[3], st.ads.viewed[0], st.ads.sim[1], st.ads.players[2]], [2, 1, 1, 1]);
  assert.strictEqual(st.days[13].ads, 1); assert.strictEqual(st.days[13].adsSim, 1);
  assert.strictEqual(st.top[0].top, 10); assert.ok(st.recentUsers.length === 7);
  assert.ok(!JSON.stringify(st).includes('password_hash') && !JSON.stringify(st).includes('@'), 'no secrets or e-mails in admin stats');
  r = await call('/api/admin/logout', {}, adm); r = await call('/api/admin/stats', null, adm); assert.strictEqual(r.status, 401);
  ok('admin: sign-in from the admins table, stats, logout');

  server.close();
  console.log('Svi testovi servera prolaze.');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
