#!/usr/bin/env node
// Uploads a signed .aab to a Google Play testing track (closed testing = "alpha" by default) and
// sends it for review, through the Google Play Developer API with a service account. Node 18+, no npm.
// Used by the GitHub Actions workflow (Actions → Android app → Run workflow → upload to Google Play),
// and works on a computer too:
//
//   node android/tools/play-upload.js --key topple-play-xxxx.json --aab app-release.aab [--track alpha] [--notes "…"]
//
// The service account needs, in Play Console → Users and permissions, the app permission
// "Release to testing tracks" (and "Release to production…" for --track production).
const fs = require('fs');
const crypto = require('crypto');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const PACKAGE = arg('package') || 'software.rdd.topple';
const TRACK = arg('track') || 'alpha';
const API = process.env.PLAY_API_URL || 'https://androidpublisher.googleapis.com';
const OAUTH = process.env.PLAY_OAUTH_URL || 'https://oauth2.googleapis.com/token';

async function accessToken(key) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: OAUTH, iat: now, exp: now + 3600 });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), crypto.createPrivateKey(key.private_key)).toString('base64url');
  const res = await fetch(OAUTH, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  if (!res.ok) throw new Error(`Google OAuth: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).access_token;
}

(async () => {
  const keyFile = arg('key'), aab = arg('aab');
  if (!keyFile || !aab) throw new Error('Treba --key <JSON ključ servisnog računa> i --aab <putanja do .aab>.');
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const token = await accessToken(key);
  const api = async (method, url, body, type = 'application/json') => {
    const res = await fetch(API + url, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': type } : {}) }, body: body && (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${url.split('?')[0]} → HTTP ${res.status} ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : {};
  };
  const base = `/androidpublisher/v3/applications/${PACKAGE}/edits`;
  const edit = await api('POST', base, {});
  const bundle = await api('POST', `/upload${base}/${edit.id}/bundles?uploadType=media`, fs.readFileSync(aab), 'application/octet-stream');
  console.log(`Uploadan build ${bundle.versionCode}.`);
  const notes = arg('notes');
  await api('PUT', `${base}/${edit.id}/tracks/${TRACK}`, {
    track: TRACK,
    releases: [{ versionCodes: [String(bundle.versionCode)], status: 'completed', ...(notes ? { releaseNotes: [{ language: 'hr', text: notes }] } : {}) }],
  });
  await api('POST', `${base}/${edit.id}:commit`);
  console.log(`Build ${bundle.versionCode} je u traci „${TRACK}” i poslan na pregled (Play Console → Publishing overview).`);
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
