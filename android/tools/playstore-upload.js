#!/usr/bin/env node
// Enters the Google Play store listing for all four languages through the Google Play Developer
// API: name, short and full description from android/PlayStore.md, and with --images also the
// icon, feature graphic and phone screenshots from android/store/. Node 18+, no npm.
//
//   node android/tools/playstore-upload.js --dry-run
//   node android/tools/playstore-upload.js --key ~/Downloads/topple-play-xxxx.json [--images]
//
// --key: the JSON key of the service account (the same one as for Topple Plus, see android/README.md);
// in Play Console it needs the app permission "Manage store presence". The app must already exist
// in Play Console with at least one uploaded build. Existing listing texts are replaced; with
// --images the existing images of each language are replaced too.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry-run');
const IMAGES = process.argv.includes('--images');
const PACKAGE = arg('package') || 'software.rdd.topple';
const ROOT = path.join(__dirname, '..');
const API = process.env.PLAY_API_URL || 'https://androidpublisher.googleapis.com';
const OAUTH = process.env.PLAY_OAUTH_URL || 'https://oauth2.googleapis.com/token';
// Section heading in PlayStore.md -> Play language code and folder of screenshots in store/.
const LANGS = { Hrvatski: { code: 'hr', shots: 'hr' }, English: { code: 'en-US', shots: 'en-US' }, Italiano: { code: 'it-IT', shots: 'it' }, Deutsch: { code: 'de-DE', shots: 'de-DE' } };
const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };

// --- texts from android/PlayStore.md ------------------------------------------------
function readListings() {
  const md = fs.readFileSync(path.join(ROOT, 'PlayStore.md'), 'utf8');
  const out = [];
  for (const sec of md.split('\n## ').slice(1)) {
    const lang = Object.entries(LANGS).find(([k]) => sec.startsWith(k));
    if (!lang) continue;
    const field = label => {
      const m = new RegExp(`\\*\\*${label}[^*]*\\*\\*(.*?)(?=\\n\\n\\*\\*|\\n---|$)`, 's').exec(sec);
      return m ? m[1].trim() : '';
    };
    out.push({
      ...lang[1],
      title: field('Naziv').replace(/^:?\s*/, ''),
      shortDescription: field('Kratki opis'),
      fullDescription: field('Puni opis'),
    });
  }
  return out;
}

// --- Google API -----------------------------------------------------------------------
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
  const res = await fetch(API + url, {
    method, headers: { Authorization: 'Bearer ' + await accessToken(), ...(body ? { 'Content-Type': contentType } : {}) },
    body: body && (Buffer.isBuffer(body) ? body : JSON.stringify(body)),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.split('?')[0]} → HTTP ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

(async () => {
  const listings = readListings();
  if (listings.length !== 4) throw new Error(`U android/PlayStore.md pronađeno ${listings.length} jezika, očekivano 4.`);
  for (const l of listings) {
    for (const [f, max] of Object.entries(LIMITS)) {
      if (!l[f]) throw new Error(`${l.code}: nedostaje ${f}`);
      if ([...l[f]].length > max) throw new Error(`${l.code}: ${f} ima ${[...l[f]].length} znakova, najviše ${max}`);
    }
    l.shotFiles = fs.readdirSync(path.join(ROOT, 'store', l.shots)).filter(f => /-phone\.png$/.test(f)).sort().map(f => path.join(ROOT, 'store', l.shots, f));
    if (IMAGES && l.shotFiles.length < 2) throw new Error(`${l.code}: treba barem 2 snimke zaslona u android/store/${l.shots}/`);
  }
  for (const l of listings) console.log(`${l.code.padEnd(6)} naziv ${l.title.length}/30, kratki ${[...l.shortDescription].length}/80, puni ${[...l.fullDescription].length}/4000${IMAGES ? `, ${l.shotFiles.length} snimki` : ''}`);
  if (DRY) return console.log('\nNišta nije poslano (--dry-run).');
  if (!arg('key')) throw new Error('Treba --key <JSON ključ servisnog računa>.');

  const base = `/androidpublisher/v3/applications/${PACKAGE}/edits`;
  const edit = await api('POST', base, {});
  const e = `${base}/${edit.id}`;
  await api('PATCH', `${e}/details`, { defaultLanguage: 'hr', contactEmail: 'info@rdd.software', contactWebsite: 'https://topple.rdd.software' });
  for (const l of listings) {
    await api('PUT', `${e}/listings/${l.code}`, { language: l.code, title: l.title, shortDescription: l.shortDescription, fullDescription: l.fullDescription });
    console.log(`${l.code}: tekstovi upisani`);
    if (!IMAGES) continue;
    const upload = async (type, file) => api('POST', `/upload${e}/listings/${l.code}/${type}?uploadType=media`, fs.readFileSync(file), 'image/png');
    for (const type of ['icon', 'featureGraphic', 'phoneScreenshots']) await api('DELETE', `${e}/listings/${l.code}/${type}`);
    await upload('icon', path.join(ROOT, 'store', 'icon-512.png'));
    await upload('featureGraphic', path.join(ROOT, 'store', 'feature-graphic.png'));
    for (const f of l.shotFiles) await upload('phoneScreenshots', f);
    console.log(`${l.code}: ikona, naslovna grafika i ${l.shotFiles.length} snimki`);
  }
  await api('POST', `${e}:commit`);
  console.log('\nGotovo: izmjene su spremljene u Play Consoleu (Store presence → Main store listing).');
})().catch(err => { console.error('GREŠKA: ' + err.message); process.exit(1); });
