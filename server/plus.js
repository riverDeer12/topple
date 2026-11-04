// Checks a StoreKit 2 signed transaction (JWS) from the iOS app, so the server can trust that a
// player bought Topple Plus. Node built-ins only, no network: the certificate chain comes in the
// JWS header (x5c) and must end in Apple's root (Apple Root CA - G3, pinned by its SHA-256).
const crypto = require('crypto');

const APPLE_ROOT_G3 = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';
const rootPins = () => (process.env.PLUS_ROOT_SHA256 || APPLE_ROOT_G3).toUpperCase().split(',');
// Marker extensions Apple puts in the App Store signing certificates (OIDs 1.2.840.113635.100.6.11.1
// on the leaf and 1.2.840.113635.100.6.2.1 on the intermediate), DER-encoded.
const LEAF_OID = Buffer.from('060a2a864886f76364060b01', 'hex');
const MID_OID = Buffer.from('060a2a864886f76364060201', 'hex');

// Returns the transaction claims, or null if the JWS is not a valid App Store signature.
function verifyTransaction(jws) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); payload = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch (e) { return null; }
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length !== 3) return null;
  let leaf, mid, root;
  try { [leaf, mid, root] = header.x5c.map(c => new crypto.X509Certificate(Buffer.from(c, 'base64'))); } catch (e) { return null; }
  if (!rootPins().includes(root.fingerprint256.toUpperCase())) return null;
  if (!root.verify(root.publicKey) || !mid.verify(root.publicKey) || !leaf.verify(mid.publicKey)) return null;
  if (!leaf.raw.includes(LEAF_OID) || !mid.raw.includes(MID_OID)) return null;
  // Certificates must have been valid when Apple signed the transaction.
  const at = Number(payload.signedDate) || Date.now();
  for (const c of [leaf, mid]) if (at < Date.parse(c.validFrom) || at > Date.parse(c.validTo)) return null;
  const ok = crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
  return ok ? payload : null;
}

module.exports = { verifyTransaction, APPLE_ROOT_G3 };
