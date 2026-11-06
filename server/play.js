// Google Play purchases, server side: checks a Topple Plus purchase token from the Android app
// with the Google Play Developer API, so the server can trust that a player bought it.
// Node built-ins only. Settings in play.json next to the database (`node server/admin.js set-play`):
// the JSON key of a Google Cloud service account that has access to the app in Play Console.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const oauth = () => process.env.PLAY_OAUTH_URL || 'https://oauth2.googleapis.com/token';
const api = () => process.env.PLAY_API_URL || 'https://androidpublisher.googleapis.com';
const configFile = () => path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, 'topple.db')), 'play.json');
function config() {
  try { const c = JSON.parse(fs.readFileSync(configFile(), 'utf8')); return c.client_email && c.private_key ? c : null; } catch (e) { return null; }
}

// Service account -> OAuth access token (a signed RS256 JWT, exchanged once an hour).
let cached = null;
async function accessToken(cfg) {
  if (cached && cached.email === cfg.client_email && cached.exp > Date.now() + 60e3) return cached.token;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: cfg.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: oauth(), iat: now, exp: now + 3600 });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), crypto.createPrivateKey(cfg.private_key)).toString('base64url');
  const res = await fetch(oauth(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  if (!res.ok) throw new Error(`Google OAuth: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: cfg.client_email };
  return cached.token;
}

// One-time product purchase -> { orderId, state: 'purchased' | 'pending' | 'canceled' },
// null when Google does not know the token, { off: true } when play.json is not set up.
async function verifyPurchase(packageName, productId, token) {
  const cfg = config();
  if (!cfg) return { off: true };
  const url = `${api()}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + await accessToken(cfg) } });
  if (res.status === 400 || res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google Play API: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const p = await res.json();
  return { orderId: String(p.orderId || ''), state: p.purchaseState === 0 ? 'purchased' : p.purchaseState === 2 ? 'pending' : 'canceled' };
}

module.exports = { verifyPurchase, configFile, config, _reset: () => { cached = null; } };
