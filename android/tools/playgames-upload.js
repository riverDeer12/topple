#!/usr/bin/env node
// Enters the 15 achievements and 2 leaderboards in Google Play Games Services through the Play
// Games Services Publishing API (texts in four languages, points, icons) and writes the IDs Google
// gives them to android/app/src/main/res/values/games-ids.xml, which the app reads. Achievement
// data comes from ios/GameCenter.md (same as Game Center), icons from android/store/achievements/.
// Node 18+, no npm.
//
//   node android/tools/playgames-upload.js --dry-run
//   node android/tools/playgames-upload.js --key topple-play-xxxx.json --app 123456789012
//
// --key: the JSON key of the service account (the same one as for Topple Plus, see android/README.md);
// --app: the Play Games Services project ID (Play Console → Play Games Services → Configuration).
// Achievements and leaderboards that already exist (same name in English) are kept, not duplicated.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry-run');
const ROOT = path.join(__dirname, '..', '..');
const API = process.env.PGS_API_URL || 'https://gamesconfiguration.googleapis.com';
const OAUTH = process.env.PGS_OAUTH_URL || 'https://oauth2.googleapis.com/token';
const OUT = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'games-ids.xml');
const LOCALES = { 'Hrvatski (Croatian)': 'hr', 'English (U.S.)': 'en-US', 'Italiano (Italian)': 'it-IT', 'Deutsch (German)': 'de-DE' };
const LEADERBOARDS = [
  { key: 'stars', names: { hr: 'Zvjezdice u razinama', 'en-US': 'Stars in levels', 'it-IT': 'Stelle nei livelli', 'de-DE': 'Sterne in Leveln' } },
  { key: 'endless', names: { hr: 'Beskonačne zagonetke', 'en-US': 'Endless puzzles', 'it-IT': 'Rompicapi infiniti', 'de-DE': 'Endlos-Rätsel' } },
];

// --- data from ios/GameCenter.md ----------------------------------------------------
function readAchievements() {
  const md = fs.readFileSync(path.join(ROOT, 'ios', 'GameCenter.md'), 'utf8');
  const rows = text => text.split('\n').filter(l => /^\| `topple\.ach\./.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim().replace(/^`|`$/g, '')));
  const sections = md.split('\n## ');
  const list = rows(sections[0]).map(([id, points], i) => ({ id: id.replace('topple.ach.', ''), points: Number(points), rank: i + 1, names: {}, descs: {} }));
  for (const sec of sections.slice(1)) {
    const locale = LOCALES[sec.split('\n')[0].trim()];
    if (!locale) continue;
    for (const [id, name, before] of rows(sec)) {
      const a = list.find(x => 'topple.ach.' + x.id === id);
      if (a) { a.names[locale] = name; a.descs[locale] = before; }
    }
  }
  for (const a of list) a.icon = path.join(ROOT, 'android', 'store', 'achievements', a.id + '.png');
  return list;
}

// --- Google API ---------------------------------------------------------------------
let token = null;
async function accessToken() {
  if (token) return token;
  const key = JSON.parse(fs.readFileSync(arg('key'), 'utf8'));
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: OAUTH, iat: now, exp: now + 3600 });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), crypto.createPrivateKey(key.private_key)).toString('base64url');
  const res = await fetch(OAUTH, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  if (!res.ok) throw new Error(`Google OAuth: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (token = (await res.json()).access_token);
}
async function api(method, url, body, contentType = 'application/json') {
  const res = await fetch(API + url, { method, headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': contentType }, body: body && (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → HTTP ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}
async function list(kind) {
  const items = [];
  let page = '';
  do {
    const r = await api('GET', `/games/v1configuration/applications/${arg('app')}/${kind}?maxResults=200${page ? '&pageToken=' + page : ''}`);
    items.push(...(r.items || []));
    page = r.nextPageToken || '';
  } while (page);
  return items;
}
const bundle = names => ({ kind: 'gamesConfiguration#localizedStringBundle', translations: Object.entries(names).map(([locale, value]) => ({ kind: 'gamesConfiguration#localizedString', locale, value })) });
const english = cfg => ((cfg.draft || cfg.published || {}).name?.translations || []).find(t => t.locale === 'en-US')?.value;
const icon = (id, type, file) => api('POST', `/upload/games/v1configuration/images/${id}/imageType/${type}?uploadType=media`, fs.readFileSync(file), 'image/png');

function writeIds(app, ids) {
  const lines = [`    <string name="game_services_project_id" translatable="false">${app}</string>`];
  for (const [name, id] of Object.entries(ids)) lines.push(`    <string name="${name}" translatable="false">${id}</string>`);
  fs.writeFileSync(OUT, `<?xml version="1.0" encoding="utf-8"?>\n<!-- Google Play Games Services IDs, written by android/tools/playgames-upload.js. Empty = not set up. -->\n<resources>\n${lines.join('\n')}\n</resources>\n`);
}

(async () => {
  const achievements = readAchievements();
  const total = achievements.reduce((s, a) => s + a.points, 0);
  for (const a of achievements) {
    if (Object.keys(a.names).length !== 4) throw new Error(`${a.id}: nedostaje prijevod u ios/GameCenter.md`);
    if (a.points % 5 || a.points > 200) throw new Error(`${a.id}: bodovi moraju biti višekratnik od 5, najviše 200`);
    if (!fs.existsSync(a.icon)) throw new Error(`${a.id}: nema ikone ${a.icon}`);
  }
  if (total > 1000) throw new Error(`Ukupno ${total} bodova, Google dopušta najviše 1000.`);
  if (DRY) {
    for (const a of achievements) console.log(`${a.id.padEnd(10)} ${String(a.points).padStart(3)}  ${a.names['en-US']} / ${a.names.hr}`);
    for (const l of LEADERBOARDS) console.log(`leaderboard ${l.key}: ${l.names['en-US']} / ${l.names.hr}`);
    console.log(`\n${achievements.length} postignuća, ${total} bodova, ${LEADERBOARDS.length} ljestvice. Ništa nije poslano (--dry-run).`);
    return;
  }
  if (!arg('key') || !arg('app')) throw new Error('Treba --key <json ključ servisnog računa> i --app <Play Games Services project ID>.');
  const ids = {};
  const existingA = await list('achievements');
  for (const a of achievements) {
    let cfg = existingA.find(x => english(x) === a.names['en-US']);
    if (cfg) console.log(`postoji: ${a.names['en-US']}`);
    else {
      cfg = await api('POST', `/games/v1configuration/applications/${arg('app')}/achievements`, {
        kind: 'gamesConfiguration#achievementConfiguration', achievementType: 'STANDARD', initialState: 'REVEALED',
        draft: { kind: 'gamesConfiguration#achievementConfigurationDetail', name: bundle(a.names), description: bundle(a.descs), pointValue: a.points, sortRank: a.rank },
      });
      await icon(cfg.id, 'ACHIEVEMENT_ICON', a.icon);
      console.log(`dodano: ${a.names['en-US']} (${cfg.id})`);
    }
    ids['achievement_' + a.id] = cfg.id;
  }
  const existingL = await list('leaderboards');
  for (const [i, l] of LEADERBOARDS.entries()) {
    let cfg = existingL.find(x => english(x) === l.names['en-US']);
    if (cfg) console.log(`postoji: ${l.names['en-US']}`);
    else {
      cfg = await api('POST', `/games/v1configuration/applications/${arg('app')}/leaderboards`, {
        kind: 'gamesConfiguration#leaderboardConfiguration', scoreOrder: 'LARGER_IS_BETTER',
        draft: { kind: 'gamesConfiguration#leaderboardConfigurationDetail', name: bundle(l.names), sortRank: i + 1, scoreFormat: { numberFormatType: 'NUMERIC' } },
      });
      await icon(cfg.id, 'LEADERBOARD_ICON', path.join(ROOT, 'android', 'store', 'icon-512.png'));
      console.log(`dodano: ${l.names['en-US']} (${cfg.id})`);
    }
    ids['leaderboard_' + l.key] = cfg.id;
  }
  writeIds(arg('app'), ids);
  console.log(`\nID-jevi su upisani u ${path.relative(process.cwd(), OUT)}. Pošalji tu datoteku u repozitorij (git commit + push), pa novi build ima Play Games.`);
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
