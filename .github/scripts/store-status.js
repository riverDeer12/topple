#!/usr/bin/env node
// Writes the current state of the app in the App Store and/or on Google Play to a JSON file, so the
// project dashboard can show what is live, in review or in testing. Node 18+, no npm, read-only:
// it never changes anything in App Store Connect or the Play Console.
//
//   node .github/scripts/store-status.js --out store-status.json \
//     [--asc-bundle software.rdd.topple] [--play-package software.rdd.topple]
//
// App Store Connect: env ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY (the .p8 text) or ASC_KEY_BASE64.
// Google Play: env PLAY_KEY_JSON (service account JSON) or PLAY_ACCESS_TOKEN (e.g. from
// google-github-actions/auth). A part that fails is written as {"error": "..."} and the rest still runs.
const fs = require('fs');
const crypto = require('crypto');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url');

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts && opts.method || 'GET'} ${url.split('?')[0]} -> HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// --- App Store Connect ---
function ascToken() {
  const id = process.env.ASC_KEY_ID, iss = process.env.ASC_ISSUER_ID;
  const pem = process.env.ASC_KEY || (process.env.ASC_KEY_BASE64 && Buffer.from(process.env.ASC_KEY_BASE64, 'base64').toString('utf8'));
  if (!id || !iss || !pem) throw new Error('missing ASC_KEY_ID, ASC_ISSUER_ID or ASC_KEY');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url({ alg: 'ES256', kid: id, typ: 'JWT' }) + '.' + b64url({ iss, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: crypto.createPrivateKey(pem), dsaEncoding: 'ieee-p1363' });
  return unsigned + '.' + sig.toString('base64url');
}
async function appStore(bundle) {
  const h = { headers: { Authorization: 'Bearer ' + ascToken() } };
  const api = p => getJson('https://api.appstoreconnect.apple.com' + p, h);
  const apps = await api(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundle)}`);
  const app = apps.data.find(a => a.attributes.bundleId === bundle);
  if (!app) throw new Error('no app with bundle ID ' + bundle);
  const vers = (await api(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data.map(v => ({
    version: v.attributes.versionString,
    state: v.attributes.appVersionState || v.attributes.appStoreState,
    created: v.attributes.createdDate || null,
  }));
  const isLive = v => ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'].includes(v.state);
  const live = vers.find(isLive) || null;
  const newer = vers.filter(v => !isLive(v) && !['REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE'].includes(v.state)
    && (!live || !live.created || !v.created || v.created > live.created));
  let testflight = null;
  const b = await api(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=1&include=preReleaseVersion`);
  if (b.data.length) {
    const pre = (b.included || []).find(x => x.type === 'preReleaseVersions');
    testflight = { version: pre ? pre.attributes.version : null, build: b.data[0].attributes.version,
      uploaded: b.data[0].attributes.uploadedDate, processing: b.data[0].attributes.processingState };
  }
  return { bundle, appId: app.id, name: app.attributes.name, live, inProgress: newer, testflight };
}

// --- Google Play ---
async function playToken() {
  if (process.env.PLAY_ACCESS_TOKEN) return process.env.PLAY_ACCESS_TOKEN;
  if (!process.env.PLAY_KEY_JSON) throw new Error('missing PLAY_KEY_JSON or PLAY_ACCESS_TOKEN');
  const key = JSON.parse(process.env.PLAY_KEY_JSON);
  const oauth = 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64url({ alg: 'RS256', typ: 'JWT' }) + '.' + b64url({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: oauth, iat: now, exp: now + 3600 });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const r = await getJson(oauth, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  return r.access_token;
}
async function googlePlay(pkg) {
  const auth = { Authorization: 'Bearer ' + await playToken() };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits`;
  // A read-only edit: opened, read and deleted again without a commit.
  const edit = await getJson(base, { method: 'POST', headers: auth });
  try {
    const t = await getJson(`${base}/${edit.id}/tracks`, { headers: auth });
    const tracks = (t.tracks || []).map(tr => ({
      track: tr.track,
      releases: (tr.releases || []).map(r => ({ name: r.name || null, versionCodes: r.versionCodes || [], status: r.status, userFraction: r.userFraction || null })),
    })).filter(tr => tr.releases.length);
    return { package: pkg, tracks, production: tracks.some(tr => tr.track === 'production' && tr.releases.some(r => r.status === 'completed' || r.status === 'inProgress')) };
  } finally {
    await fetch(`${base}/${edit.id}`, { method: 'DELETE', headers: auth }).catch(() => {});
  }
}

(async () => {
  const out = { checked: new Date().toISOString() };
  const safe = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = { error: String(e.message || e) }; } };
  if (arg('asc-bundle')) await safe('appStore', () => appStore(arg('asc-bundle')));
  if (arg('play-package')) await safe('googlePlay', () => googlePlay(arg('play-package')));
  fs.writeFileSync(arg('out') || 'store-status.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  // Fail the run only when every part failed, so a broken key shows up as a red run.
  const parts = ['appStore', 'googlePlay'].filter(k => out[k]);
  if (parts.length && parts.every(k => out[k].error)) process.exit(1);
})();
