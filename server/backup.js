// Copies the database to a backup file next to it, one per weekday (keeps 7), and, when
// Google Drive is set up (server/gdrive-auth.js), uploads a dated copy there as well.
// Safe while the API is running (uses SQLite VACUUM INTO). Writes a line to backup.log.
// Run: node server/backup.js [path/to/topple.db]   (default: DB_PATH or server/topple.db)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { backupToDrive } = require('./gdrive.js');

const db = process.argv[2] || process.env.DB_PATH || path.join(__dirname, 'topple.db');
const dir = path.dirname(db);
const log = msg => {
  const line = `${new Date().toISOString().slice(0, 19).replace('T', ' ')}  ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(dir, 'backup.log'), line + '\n');
};

const day = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'][new Date().getDay()];
const out = path.join(dir, `backup-${day}.db`);
fs.rmSync(out, { force: true });
new DatabaseSync(db).exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
log('Lokalna kopija: ' + out);

const name = `topple-${new Date().toISOString().slice(0, 10)}.db`;
backupToDrive(dir, out, name)
  .then(r => {
    if (!r) log('Google Drive nije postavljen (node server/gdrive-auth.js), kopija je samo lokalna.');
    else log(`Google Drive: poslano ${name}` + (r.removed ? `, obrisano starih kopija: ${r.removed}` : '') + '.');
  })
  .catch(e => { log('GREŠKA Google Drive: ' + e.message); process.exitCode = 1; });
