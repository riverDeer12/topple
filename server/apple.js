// Sign in with Apple, server side: turns the one-time authorization code from the app into a
// refresh token at sign-in, and revokes that token when the account is deleted (Apple's rule
// for apps with Sign in with Apple). Node built-ins only.
// Settings in apple.json next to the database (`node server/admin.js set-apple ...`):
//   { "teamId": "ABCDE12345", "keyId": "XYZ987ABCD", "key": "-----BEGIN PRIVATE KEY-----..." }
// The key is a "Sign in with Apple" key (.p8) from the Apple Developer account.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const auth = () => process.env.APPLE_AUTH_URL || 'https://appleid.apple.com';
const configFile = () => path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, 'topple.db')), 'apple.json');
function config() {
  try { const c = JSON.parse(fs.readFileSync(configFile(), 'utf8')); return c.teamId && c.keyId && c.key ? c : null; } catch (e) { return null; }
}

// The client secret is a short-lived ES256 JWT signed with the .p8 key.
function clientSecret(cfg, clientId) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'ES256', kid: cfg.keyId }) + '.' + b64({ iss: cfg.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: crypto.createPrivateKey(cfg.key), dsaEncoding: 'ieee-p1363' });
  return unsigned + '.' + sig.toString('base64url');
}
async function post(endpoint, form) {
  const res = await fetch(auth() + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apple ${endpoint}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}
// Authorization code (valid 5 minutes, once) -> refresh token, or null when not set up.
async function exchange(code, clientId) {
  const cfg = config();
  if (!cfg || !code) return null;
  const r = await post('/auth/token', { client_id: clientId, client_secret: clientSecret(cfg, clientId), code, grant_type: 'authorization_code' });
  return r.refresh_token || null;
}
async function revoke(refreshToken, clientId) {
  const cfg = config();
  if (!cfg || !refreshToken) return false;
  await post('/auth/revoke', { client_id: clientId, client_secret: clientSecret(cfg, clientId), token: refreshToken, token_type_hint: 'refresh_token' });
  return true;
}

module.exports = { config, configFile, clientSecret, exchange, revoke };
