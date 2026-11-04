// App Store Connect API helpers (Node 18+, no npm): ES256 token from an API key and JSON calls.
// Key: App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys.
const fs = require('fs');
const crypto = require('crypto');

const API = process.env.ASC_API_URL || 'https://api.appstoreconnect.apple.com';
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };

let token = null, tokenAt = 0;
function jwt() {
  if (token && Date.now() - tokenAt < 15 * 60e3) return token;
  if (!arg('key') || !arg('key-id') || !arg('issuer')) throw new Error('Nedostaju --key, --key-id i --issuer.');
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
    throw new Error(`${method} ${url.split('?')[0]} → HTTP ${res.status} ${e || text.slice(0, 300)}`);
  }
  return json;
}
async function all(url) {
  const out = [];
  for (let next = url; next;) { const r = await api('GET', next); out.push(...r.data); next = r.links && r.links.next; }
  return out;
}
const rel = (type, id) => ({ data: { type, id } });
async function appByBundle(bundle) {
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(bundle)}`);
  if (!apps.data.length) throw new Error(`Nema aplikacije s bundle ID-jem ${bundle}.`);
  return apps.data[0];
}

module.exports = { arg, api, all, rel, appByBundle };
