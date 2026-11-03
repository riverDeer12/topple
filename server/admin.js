// Account administration on the server. Run in the app folder, e.g.:
//   node server/admin.js list                                   (players and their sign-in methods)
//   node server/admin.js set-login <name> <email> <password>    (as if the player had registered with them)
//   node server/admin.js set-password <name> <password>
//   node server/admin.js stats                                  (players, guests, activity, how far guests get)
//   node server/admin.js set-admin <name> <password>            (sign-in for the admin page /admin; again to change the password)
//   node server/admin.js set-smtp <host> <port> <user> <password> "<from>"   (e-mail for "forgot password")
//   node server/admin.js test-mail <email>                      (sends a test e-mail with those settings)
//   node server/admin.js delete <name> [--yes]                  (removes the player and all their data; without --yes only shows what would go)
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
} else if (cmd === 'stats') {
  const now = Date.now(), n = (q, ...a) => db.prepare(q).get(...a).n;
  const since = days => now - days * 864e5;
  const users = n('SELECT COUNT(*) AS n FROM users');
  const guests = n('SELECT COUNT(*) AS n FROM guests'), converted = n('SELECT COUNT(*) AS n FROM guests WHERE user_id IS NOT NULL');
  console.log(`Registrirani igrači: ${users}`);
  console.log(`Gosti ukupno: ${guests} (od toga se registriralo ili prijavilo: ${converted}${guests ? `, ${Math.round(100 * converted / guests)} %` : ''})`);
  for (const [label, d] of [['danas (24 h)', 1], ['zadnjih 7 dana', 7], ['zadnjih 30 dana', 30]]) {
    console.log(`Aktivni gosti ${label}: ${n('SELECT COUNT(*) AS n FROM guests WHERE last_seen > ?', since(d))}, novi: ${n('SELECT COUNT(*) AS n FROM guests WHERE first_seen > ?', since(d))}`);
  }
  console.log('Gosti po broju riješenih razina:');
  for (const r of db.prepare(`SELECT CASE WHEN levels = 0 THEN '0' WHEN levels <= 3 THEN '1-3' WHEN levels <= 9 THEN '4-9' ELSE '10+' END AS b, COUNT(*) AS c FROM guests GROUP BY b ORDER BY MIN(levels)`).all()) console.log(`  ${r.b.padEnd(5)} ${r.c}`);
  console.log('Gosti po jeziku: ' + db.prepare('SELECT COALESCE(lang, \'?\') AS l, COUNT(*) AS c FROM guests GROUP BY l ORDER BY c DESC').all().map(r => `${r.l} ${r.c}`).join(', '));
  console.log(`Prosječno posjeta po gostu: ${guests ? (n('SELECT SUM(visits) AS n FROM guests') / guests).toFixed(1) : 0}`);
} else if (cmd === 'set-admin') {
  const [name, password] = rest;
  if (!name || !password) fail('Nedostaju podaci. Primjer: node server/admin.js set-admin Ana \'duga-lozinka\'');
  if (password.length < 10) fail('Lozinka administratora mora imati najmanje 10 znakova.');
  db.prepare('INSERT INTO admins (name, password_hash) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET password_hash = excluded.password_hash').run(name, hashPassword(password));
  db.prepare('DELETE FROM admin_sessions WHERE admin = ?').run(name); // a new password signs out old admin sessions
  console.log(`Gotovo: administrator ${name} se može prijaviti na /admin.`);
} else if (cmd === 'set-smtp') {
  const [host, port, user, pass, from] = rest;
  if (!host || !port || !user || !pass) fail('Nedostaju podaci. Primjer: node server/admin.js set-smtp mail.example.com 587 info@rdd.software \'lozinka\' "Topple <info@rdd.software>"');
  const mail = require('./mail.js');
  require('fs').writeFileSync(mail.configFile(), JSON.stringify({ host, port: Number(port), user, pass, from: from || `Topple <${user}>` }, null, 2));
  console.log(`Spremljeno u ${mail.configFile()}. Provjeri slanjem: node server/admin.js test-mail tvoj@email.com`);
} else if (cmd === 'test-mail') {
  const mail = require('./mail.js');
  if (!rest[0]) fail('Nedostaje e-mail. Primjer: node server/admin.js test-mail tvoj@email.com');
  if (!mail.config()) fail('SMTP nije postavljen (naredba set-smtp).');
  mail.sendMail({ to: rest[0], subject: 'Topple: probni e-mail', text: 'Slanje e-maila za Topple radi. Igrači sada mogu zatražiti novu lozinku.' })
    .then(() => console.log('Poslano na ' + rest[0] + '.'), e => fail('Slanje nije uspjelo: ' + e.message));
} else if (cmd === 'delete') {
  const yes = rest.includes('--yes');
  const name = rest.filter(a => a !== '--yes').join(' ');
  if (!name) fail('Nedostaje ime. Primjer: node server/admin.js delete Ana --yes');
  const u = findUser(name);
  const count = t => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(u.id).n;
  const summary = `${u.name} (${u.email || 'bez e-maila'}): razine ${count('campaign')}, dnevne ${count('daily')}, beskonačne ${count('endless')}, prijave na uređajima ${count('sessions')}`;
  if (!yes) { console.log(`Bilo bi obrisano: ${summary}.\nZa brisanje ponovi naredbu s --yes na kraju.`); process.exit(0); }
  db.exec('BEGIN');
  try {
    for (const t of ['campaign', 'daily', 'endless', 'sessions']) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(u.id);
    db.prepare('UPDATE guests SET user_id = NULL WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  console.log(`Obrisano: ${summary}.`);
} else {
  console.log('Naredbe: list | stats | set-login <ime> <email> <lozinka> | set-password <ime> <lozinka> | set-admin <ime> <lozinka> | set-smtp <host> <port> <korisnik> <lozinka> <od> | test-mail <email> | delete <ime> [--yes]   [--db putanja]');
}
