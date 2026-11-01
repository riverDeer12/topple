// Copies the database to a backup file next to it, one per weekday (keeps 7).
// Safe while the API is running (uses SQLite VACUUM INTO).
// Run: node server/backup.js [path/to/topple.db]   (default: DB_PATH or server/topple.db)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = process.argv[2] || process.env.DB_PATH || path.join(__dirname, 'topple.db');
const day = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'][new Date().getDay()];
const out = path.join(path.dirname(db), `backup-${day}.db`);
fs.rmSync(out, { force: true });
new DatabaseSync(db).exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
console.log('Kopija spremljena: ' + out);
