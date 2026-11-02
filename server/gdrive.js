// Uploads database backups to Google Drive (folder RDD / DB_Backups / Topple by default),
// using only Node's built-in fetch, no npm packages.
// Access uses the drive.file scope: the script only sees files and folders it created itself.
// Settings and the refresh token live in gdrive.json next to the database (created by
// server/gdrive-auth.js). Base URLs can be overridden for tests.
const fs = require('fs');
const path = require('path');

const OAUTH = process.env.GDRIVE_OAUTH_URL || 'https://oauth2.googleapis.com';
const API = process.env.GDRIVE_API_URL || 'https://www.googleapis.com';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULT_PATH = ['RDD', 'DB_Backups', 'Topple'];

const configFile = dataDir => path.join(dataDir, 'gdrive.json');
const load = dataDir => (fs.existsSync(configFile(dataDir)) ? JSON.parse(fs.readFileSync(configFile(dataDir), 'utf8')) : null);
const save = (dataDir, cfg) => fs.writeFileSync(configFile(dataDir), JSON.stringify(cfg, null, 2));

async function call(url, opts, what) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}
async function accessToken(cfg) {
  const body = new URLSearchParams({ client_id: cfg.client_id, client_secret: cfg.client_secret, refresh_token: cfg.refresh_token, grant_type: 'refresh_token' });
  const res = await call(OAUTH + '/token', { method: 'POST', body }, 'Google prijava');
  return (await res.json()).access_token;
}
const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function findOrCreateFolder(token, name, parent) {
  const query = `name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false and '${parent}' in parents`;
  const res = await call(`${API}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } }, 'Traženje mape');
  const found = (await res.json()).files[0];
  if (found) return found.id;
  const made = await call(`${API}/drive/v3/files?fields=id`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  }, 'Izrada mape');
  return (await made.json()).id;
}
// The target folder. Its id is remembered, so the folder can be renamed or moved in Drive
// (for example into an RDD folder you made yourself) and uploads keep going there.
async function folder(token, cfg, dataDir) {
  if (cfg.folder_id) {
    const res = await fetch(`${API}/drive/v3/files/${cfg.folder_id}?fields=id,trashed`, { headers: { Authorization: 'Bearer ' + token } });
    if (res.ok && !(await res.json()).trashed) return cfg.folder_id;
  }
  let parent = 'root';
  for (const name of cfg.folder_path || DEFAULT_PATH) parent = await findOrCreateFolder(token, name, parent);
  cfg.folder_id = parent;
  save(dataDir, cfg);
  return parent;
}
// Resumable upload works for any file size.
async function uploadFile(token, folderId, file, name) {
  const start = await call(`${API}/upload/drive/v3/files?uploadType=resumable&fields=id`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/x-sqlite3' },
    body: JSON.stringify({ name, parents: [folderId] }),
  }, 'Početak slanja');
  const res = await call(start.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'application/x-sqlite3' }, body: fs.readFileSync(file) }, 'Slanje datoteke');
  return (await res.json()).id;
}
// Deletes the oldest backups beyond `keep` (only files this script uploaded are visible to it).
async function prune(token, folderId, keep) {
  const query = `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`;
  const res = await call(`${API}/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=1000&fields=files(id,name)`, { headers: { Authorization: 'Bearer ' + token } }, 'Popis kopija');
  const old = (await res.json()).files.slice(keep);
  for (const f of old) await call(`${API}/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }, 'Brisanje stare kopije');
  return old.length;
}
async function backupToDrive(dataDir, file, name) {
  const cfg = load(dataDir);
  if (!cfg) return null; // not set up
  const token = await accessToken(cfg);
  const folderId = await folder(token, cfg, dataDir);
  const id = await uploadFile(token, folderId, file, name);
  const removed = await prune(token, folderId, cfg.keep || 30);
  return { id, folderId, removed };
}
module.exports = { backupToDrive, accessToken, folder, load, save, configFile, DEFAULT_PATH, OAUTH };
