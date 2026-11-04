#!/usr/bin/env node
// Enters the 15 Game Center achievements in App Store Connect through the App Store Connect
// API: IDs and points, texts in four languages and the images. Data comes from
// ios/GameCenter.md (points and texts) and ios/achievements/<id>.png. Node 18+, no npm.
//
//   node ios/tools/gamecenter-upload.js --key AuthKey_ABC123.p8 --key-id ABC123 --issuer 1234-...-abcd [--dry-run]
//
// The API key: App Store Connect → Users and Access → Integrations → App Store Connect API →
// Team Keys → + (Access: App Manager). Achievements that already exist (same ID) are left
// as they are; their missing languages and images are added.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry-run');
const BUNDLE = arg('bundle') || 'software.rdd.topple';
const ROOT = path.join(__dirname, '..');
const API = process.env.ASC_API_URL || 'https://api.appstoreconnect.apple.com';
const LOCALES = { 'Hrvatski (Croatian)': 'hr', 'English (U.S.)': 'en-US', 'Italiano (Italian)': 'it', 'Deutsch (German)': 'de-DE' };

// --- data from GameCenter.md ------------------------------------------------------
function readData() {
  const md = fs.readFileSync(path.join(ROOT, 'GameCenter.md'), 'utf8');
  const rows = text => text.split('\n').filter(l => /^\| `topple\.ach\./.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim().replace(/^`|`$/g, '')));
  const sections = md.split('\n## ');
  const list = rows(sections[0]).map(([id, points, ref]) => ({ id, points: Number(points), ref, locs: {} }));
  for (const sec of sections.slice(1)) {
    const locale = LOCALES[sec.split('\n')[0].trim()];
    if (!locale) continue;
    for (const [id, name, before, after] of rows(sec)) {
      const a = list.find(x => x.id === id);
      if (a) a.locs[locale] = { name, before, after };
    }
  }
  for (const a of list) a.image = path.join(ROOT, 'achievements', a.id.replace('topple.ach.', '') + '.png');
  return list;
}

// --- App Store Connect API ----------------------------------------------------------
let token = null, tokenAt = 0;
function jwt() {
  if (token && Date.now() - tokenAt < 15 * 60e3) return token;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'ES256', kid: arg('key-id'), typ: 'JWT' }) + '.' + b64({ iss: arg('issuer'), iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
  const key = crypto.createPrivateKey(fs.readFileSync(arg('key'), 'utf8'));
  token = unsigned + '.' + crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  tokenAt = Date.now();
  return token;
}
async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = (json.errors || []).map(x => `${x.title}: ${x.detail}`).join('; ');
    throw new Error(`${method} ${url} → HTTP ${res.status} ${e || text.slice(0, 300)}`);
  }
  return json;
}
async function all(url) { // follows pagination
  const out = [];
  for (let next = url; next;) { const r = await api('GET', next); out.push(...r.data); next = r.links && r.links.next; }
  return out;
}
const rel = (type, id) => ({ data: { type, id } });

async function uploadImage(locId, file) {
  const data = fs.readFileSync(file);
  const r = await api('POST', '/v1/gameCenterAchievementImages', {
    data: { type: 'gameCenterAchievementImages', attributes: { fileName: path.basename(file), fileSize: data.length },
      relationships: { gameCenterAchievementLocalization: rel('gameCenterAchievementLocalizations', locId) } },
  });
  for (const op of r.data.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map(h => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: data.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload ${path.basename(file)} → HTTP ${res.status}`);
  }
  await api('PATCH', '/v1/gameCenterAchievementImages/' + r.data.id, { data: { type: 'gameCenterAchievementImages', id: r.data.id, attributes: { uploaded: true } } });
}

(async () => {
  const list = readData();
  for (const a of list) {
    const missing = Object.keys(LOCALES).map(k => LOCALES[k]).filter(l => !a.locs[l]);
    if (missing.length || !fs.existsSync(a.image)) throw new Error(`${a.id}: missing ${missing.join(', ') || 'image ' + a.image}`);
  }
  console.log(`${list.length} postignuća, ukupno ${list.reduce((s, a) => s + a.points, 0)} bodova, jezici: ${Object.values(LOCALES).join(', ')}`);
  if (DRY) { for (const a of list) console.log(`  ${a.id.padEnd(22)} ${String(a.points).padStart(3)}  ${a.locs.hr.name} / ${a.locs['en-US'].name}`); return; }
  if (!arg('key') || !arg('key-id') || !arg('issuer')) throw new Error('Nedostaju --key, --key-id i --issuer (vidi upute na vrhu datoteke).');

  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE)}`);
  if (!apps.data.length) throw new Error(`Nema aplikacije s bundle ID-jem ${BUNDLE}.`);
  const appId = apps.data[0].id;
  let detail = await api('GET', `/v1/apps/${appId}/gameCenterDetail`).catch(() => ({ data: null }));
  if (!detail.data) {
    console.log('Uključujem Game Center za aplikaciju…');
    detail = await api('POST', '/v1/gameCenterDetails', { data: { type: 'gameCenterDetails', relationships: { app: rel('apps', appId) } } });
  }
  const detailId = detail.data.id;
  const existing = await all(`/v1/gameCenterDetails/${detailId}/gameCenterAchievements?limit=200`);

  for (const a of list) {
    let ach = existing.find(x => x.attributes.vendorIdentifier === a.id);
    if (ach) console.log(`= ${a.id} već postoji`);
    else {
      ach = (await api('POST', '/v1/gameCenterAchievements', {
        data: { type: 'gameCenterAchievements',
          attributes: { referenceName: a.locs.hr.name, vendorIdentifier: a.id, points: a.points, showBeforeEarned: true, repeatable: false },
          relationships: { gameCenterDetail: rel('gameCenterDetails', detailId) } },
      })).data;
      console.log(`+ ${a.id} (${a.points} bodova)`);
    }
    const locs = await all(`/v1/gameCenterAchievements/${ach.id}/localizations?limit=50`);
    for (const [locale, t] of Object.entries(a.locs)) {
      let loc = locs.find(x => x.attributes.locale === locale);
      if (!loc) {
        loc = (await api('POST', '/v1/gameCenterAchievementLocalizations', {
          data: { type: 'gameCenterAchievementLocalizations',
            attributes: { locale, name: t.name, beforeEarnedDescription: t.before, afterEarnedDescription: t.after },
            relationships: { gameCenterAchievement: rel('gameCenterAchievements', ach.id) } },
        })).data;
        console.log(`    + ${locale}: ${t.name}`);
      }
      const img = await api('GET', `/v1/gameCenterAchievementLocalizations/${loc.id}/gameCenterAchievementImage`).catch(() => ({ data: null }));
      if (!img.data) { await uploadImage(loc.id, a.image); console.log(`    + slika (${locale})`); }
    }
  }
  console.log('\nGotovo. U App Store Connectu, na stranici verzije 1.0, u odjeljku Game Center dodaj postignuća uz verziju.');
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
