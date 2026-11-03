// Web Push (daily puzzle reminders) with Node built-ins only, no npm.
// Encryption: RFC 8291 (aes128gcm), sender identity: VAPID (RFC 8292, ES256 JWT).
// The VAPID key pair is made once and kept in vapid.json next to the database.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const b64u = b => Buffer.from(b).toString('base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

const keyFile = () => path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, 'topple.db')), 'vapid.json');
let keys = null;
function vapidKeys() {
  if (keys) return keys;
  const f = keyFile();
  if (fs.existsSync(f)) return (keys = JSON.parse(fs.readFileSync(f, 'utf8')));
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  keys = { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
  fs.writeFileSync(f, JSON.stringify(keys, null, 2));
  return keys;
}
function signingKey(k) {
  const pub = Buffer.from(k.publicKey, 'base64url');
  return crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: k.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
}
function vapidHeader(endpoint, subject = 'mailto:info@rdd.software') {
  const k = vapidKeys(), aud = new URL(endpoint).origin;
  const part = o => b64u(JSON.stringify(o));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: signingKey(k), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${k.publicKey}`;
}

// Encrypts a payload for one subscription (keys p256dh and auth, base64url). `test` fixes the
// random parts so the result can be checked against the RFC 8291 example.
function encrypt(payload, p256dh, auth, test = {}) {
  const ua = Buffer.from(p256dh, 'base64url'), secret = Buffer.from(auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1');
  if (test.asPrivate) ecdh.setPrivateKey(Buffer.from(test.asPrivate, 'base64url')); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), shared = ecdh.computeSecret(ua);
  const ikm = hmac(hmac(secret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])]));
  const salt = test.salt ? Buffer.from(test.salt, 'base64url') : crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPub.length;
  return Buffer.concat([head, asPub, body]);
}

// Only real push services: the server must not be made to post to arbitrary addresses.
const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
function validEndpoint(e) {
  if (process.env.PUSH_TEST_PREFIX && e.startsWith(process.env.PUSH_TEST_PREFIX)) return true; // local tests only
  try { const u = new URL(e); return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname) && e.length < 1000; } catch (err) { return false; }
}

// Sends one notification. Resolves to the HTTP status (404/410 mean the subscription is gone).
async function sendPush(sub, data) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: vapidHeader(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'normal' },
    body: encrypt(JSON.stringify(data), sub.p256dh, sub.auth),
  });
  return res.status;
}

module.exports = { vapidKeys, vapidHeader, encrypt, sendPush, validEndpoint, keyFile };
