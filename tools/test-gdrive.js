// Tests server/gdrive.js against a small fake Google Drive. Run: npm run test:server
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const files = new Map(); let nextId = 1; const uploads = new Map();
const fake = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let body = '';
  for await (const c of req) body += c;
  const json = (code, o, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/token') return json(200, { access_token: 'tok' });
  if (req.headers.authorization !== 'Bearer tok' && !u.pathname.startsWith('/up/')) return json(401, {});
  if (u.pathname === '/drive/v3/files' && req.method === 'GET') {
    const q = u.searchParams.get('q');
    const parent = /'([^']+)' in parents/.exec(q)[1], name = /name = '([^']+)'/.exec(q), folders = q.includes("mimeType = 'application/vnd.google-apps.folder'");
    let list = [...files.values()].filter(f => f.parents[0] === parent && (!name || f.name === name[1]) && (folders ? f.folder : !f.folder));
    list.sort((a, b) => b.created - a.created);
    return json(200, { files: list.map(f => ({ id: f.id, name: f.name })) });
  }
  if (u.pathname === '/drive/v3/files' && req.method === 'POST') {
    const m = JSON.parse(body), id = 'f' + nextId++;
    files.set(id, { id, name: m.name, parents: m.parents, folder: true, created: nextId }); return json(200, { id });
  }
  const one = /^\/drive\/v3\/files\/(\w+)$/.exec(u.pathname);
  if (one && req.method === 'GET') return files.has(one[1]) ? json(200, { id: one[1], trashed: false }) : json(404, {});
  if (one && req.method === 'DELETE') { files.delete(one[1]); res.writeHead(204); return res.end(); }
  if (u.pathname === '/upload/drive/v3/files') {
    const up = 'u' + nextId++; uploads.set(up, JSON.parse(body));
    res.writeHead(200, { Location: `http://127.0.0.1:${fake.address().port}/up/${up}` }); return res.end();
  }
  const up = /^\/up\/(\w+)$/.exec(u.pathname);
  if (up && req.method === 'PUT') {
    const m = uploads.get(up[1]), id = 'f' + nextId++;
    files.set(id, { id, name: m.name, parents: m.parents, folder: false, created: nextId, size: body.length }); return json(200, { id });
  }
  json(404, { path: u.pathname });
});

(async () => {
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${fake.address().port}`;
  process.env.GDRIVE_OAUTH_URL = base; process.env.GDRIVE_API_URL = base;
  const G = require('../server/gdrive.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topple-gd-'));
  const file = path.join(dir, 'backup-pon.db'); fs.writeFileSync(file, 'sqlite-bytes');

  assert.strictEqual(await G.backupToDrive(dir, file, 'x.db'), null); console.log('ok   not set up: nothing sent');
  G.save(dir, { client_id: 'c', client_secret: 's', refresh_token: 'r', keep: 2 });
  const r1 = await G.backupToDrive(dir, file, 'topple-1.db');
  const names = id => { const f = files.get(id); return f ? [...names(f.parents[0] || ''), f.name] : []; };
  assert.deepStrictEqual(names(r1.folderId), ['RDD', 'DB_Backups', 'Topple']);
  assert.strictEqual(files.get(r1.id).name, 'topple-1.db'); assert.strictEqual(files.get(r1.id).size, 12);
  console.log('ok   creates RDD/DB_Backups/Topple and uploads the file');
  const r2 = await G.backupToDrive(dir, file, 'topple-2.db');
  assert.strictEqual(r2.folderId, r1.folderId); assert.strictEqual(G.load(dir).folder_id, r1.folderId);
  assert.strictEqual([...files.values()].filter(f => f.folder).length, 3);
  console.log('ok   reuses the remembered folder');
  const r3 = await G.backupToDrive(dir, file, 'topple-3.db');
  assert.strictEqual(r3.removed, 1);
  assert.deepStrictEqual([...files.values()].filter(f => !f.folder).map(f => f.name).sort(), ['topple-2.db', 'topple-3.db']);
  console.log('ok   keeps only the newest backups');
  fake.close();
  console.log('Google Drive kopije: testovi prolaze.');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
