// One-time connection of database backups to your Google Drive.
//   node server/gdrive-auth.js <client.json> --db C:\inetpub\topple-data\topple.db
// <client.json> is the OAuth client (type "Desktop app") downloaded from Google Cloud.
// Prints a sign-in link; after you allow access, the refresh token is saved in gdrive.json
// next to the database, and the folder RDD / DB_Backups / Topple is created in your Drive.
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const G = require('./gdrive.js');

const args = process.argv.slice(2);
const dbAt = args.indexOf('--db');
const dbPath = dbAt >= 0 ? args.splice(dbAt, 2)[1] : (process.env.DB_PATH || path.join(__dirname, 'topple.db'));
const dataDir = path.dirname(dbPath);
const fail = msg => { console.error('GREŠKA: ' + msg); process.exit(1); };
if (!args[0] || !fs.existsSync(args[0])) fail('Navedi JSON datoteku OAuth klijenta. Primjer: node server/gdrive-auth.js client.json --db C:\\inetpub\\topple-data\\topple.db');
const raw = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const client = raw.installed || raw.web || raw;
if (!client.client_id || !client.client_secret) fail('U datoteci nema client_id i client_secret. Preuzmi JSON klijenta tipa "Desktop app".');

const PORT = 53682, REDIRECT = `http://127.0.0.1:${PORT}`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: client.client_id, redirect_uri: REDIRECT, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/drive.file',
});

async function finish(code) {
  const body = new URLSearchParams({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: REDIRECT, grant_type: 'authorization_code' });
  const res = await fetch(G.OAUTH + '/token', { method: 'POST', body });
  const tok = await res.json();
  if (!res.ok || !tok.refresh_token) fail('Google nije vratio dozvolu: ' + JSON.stringify(tok));
  const cfg = { client_id: client.client_id, client_secret: client.client_secret, refresh_token: tok.refresh_token, keep: 30, folder_path: G.DEFAULT_PATH };
  G.save(dataDir, cfg);
  const folderId = await G.folder(await G.accessToken(cfg), cfg, dataDir);
  console.log(`\nGotovo. Dozvola je spremljena u ${G.configFile(dataDir)}.`);
  console.log(`Mapa za kopije: https://drive.google.com/drive/folders/${folderId}`);
  console.log('Probaj odmah: node server/backup.js ' + dbPath);
  process.exit(0);
}

// The code arrives either at the local address (browser on this computer) or pasted by hand.
const server = http.createServer((req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(code ? '<p>Topple: dozvola primljena, možeš zatvoriti ovaj prozor.</p>' : '<p>Nema koda u adresi.</p>');
  if (code) finish(code).catch(e => fail(e.message));
});
server.on('error', () => {}); // port busy: pasting the address still works
server.listen(PORT, '127.0.0.1');

console.log('1. Otvori ovaj link u pregledniku (na bilo kojem računalu) i dopusti pristup:\n');
console.log(url + '\n');
console.log('2. Ako je preglednik na ovom serveru, dalje ide samo.');
console.log('   Ako je na drugom računalu, nakon dopuštenja otvorit će se stranica koja se ne učita');
console.log('   (adresa počinje s http://127.0.0.1). Kopiraj cijelu tu adresu i zalijepi je ovdje:\n');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', line => {
  const m = /[?&]code=([^&\s]+)/.exec(line.trim());
  if (!m) { console.log('U zalijepljenoj adresi nema "code=". Pokušaj ponovno.'); return; }
  rl.close();
  finish(decodeURIComponent(m[1])).catch(e => fail(e.message));
});
