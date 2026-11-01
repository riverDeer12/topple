// Account administration on the server. Run in the app folder, e.g.:
//   node server/admin.js list                                   (players and their sign-in methods)
//   node server/admin.js set-login <name> <email> <password>    (as if the player had registered with them)
//   node server/admin.js set-password <name> <password>
// Uses DB_PATH, or --db <path>. On the Windows server: --db C:\inetpub\topple-data\topple.db
const args = process.argv.slice(2);
const dbAt = args.indexOf('--db');
if (dbAt >= 0) process.env.DB_PATH = args.splice(dbAt, 2)[1];
const { db, hashPassword, EMAIL_RE, cleanEmail, validPassword } = require('./server.js');
const [cmd, ...rest] = args;
const fail = msg => { console.error('GREŠKA: ' + msg); process.exit(1); };
const findUser = name => db.prepare('SELECT * FROM users WHERE name = ?').get(name) || fail(`Nema igrača "${name}".`);

if (cmd === 'list') {
  for (const u of db.prepare('SELECT id, name, email, password_hash, google_sub, created_at FROM users ORDER BY id').all()) {
    const ways = [u.password_hash && 'lozinka', u.email && 'e-mail', u.google_sub && 'Google'].filter(Boolean).join(', ') || 'samo uređaj';
    console.log(`${String(u.id).padStart(4)}  ${u.name.padEnd(16)}  ${(u.email || '-').padEnd(30)}  ${ways}`);
  }
} else if (cmd === 'set-login' || cmd === 'set-password') {
  const [name, a, b] = rest;
  const email = cmd === 'set-login' ? cleanEmail(a) : null, password = cmd === 'set-login' ? b : a;
  if (!name || !password) fail('Nedostaju podaci. Primjer: node server/admin.js set-login Ana ana@example.com lozinka123');
  const u = findUser(name);
  if (cmd === 'set-login') {
    if (!EMAIL_RE.test(email)) fail('E-mail adresa nije ispravna.');
    const other = db.prepare('SELECT name FROM users WHERE email = ? AND id <> ?').get(email, u.id);
    if (other) fail(`Taj e-mail već koristi igrač "${other.name}".`);
  }
  if (!validPassword(password)) fail('Lozinka mora imati najmanje 6 znakova.');
  if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, u.id);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
  console.log(`Gotovo: ${u.name} se sada može prijaviti ${email ? `e-mailom ${email} ili ` : ''}korisničkim imenom i novom lozinkom.`);
} else {
  console.log('Naredbe: list | set-login <ime> <email> <lozinka> | set-password <ime> <lozinka>   [--db putanja]');
}
