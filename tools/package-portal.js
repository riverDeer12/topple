#!/usr/bin/env node
// Packs the web game for a game portal: a folder with the game as index.html and the files it
// needs, plus a .zip to upload. Node 18+, no npm (the zip is written here, with zlib).
//
//   node tools/package-portal.js crazygames     → dist/crazygames/ and dist/topple-crazygames.zip
//   node tools/package-portal.js itch           → dist/itch/ and dist/topple-itch.zip
//
// The copy talks to the server on topple.rdd.software (accounts, leaderboards; the server allows
// the portals' origins) and sets window.TOPPLE_PORTAL in config.js, which igra.html reads:
// CrazyGames gets its SDK (rewarded ads, gameplay events) and no links out of the game; itch.io
// keeps the links, pointing to topple.rdd.software. No service worker, no web push, no Google sign-in.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORTALS = ['crazygames', 'itch'];
const portal = process.argv[2];
if (!PORTALS.includes(portal)) { console.error(`Upotreba: node tools/package-portal.js ${PORTALS.join('|')}`); process.exit(1); }
const WEB = path.join(__dirname, '..', 'web');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(DIST, portal);
const FILES = ['core.js', 'gen.js', 'gen-worker.js', 'levels.js', 'puzzles.js', 'audio.js', 'i18n.js', 'content.js', 'theme.css', 'favicon.ico', 'icons'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(WEB, f), path.join(OUT, f), { recursive: true });

// config.js: the portal flag.
const config = fs.readFileSync(path.join(WEB, 'config.js'), 'utf8');
if (!config.includes("window.TOPPLE_PORTAL = '';")) throw new Error('config.js: TOPPLE_PORTAL nije pronađen.');
fs.writeFileSync(path.join(OUT, 'config.js'), config.replace("window.TOPPLE_PORTAL = '';", `window.TOPPLE_PORTAL = '${portal}';`));

// The game page becomes index.html, without the web app manifest (no installing from a portal).
let html = fs.readFileSync(path.join(WEB, 'igra.html'), 'utf8');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// --- zip (stored paths relative to the folder, deflate) ---
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const parts = [], central = [];
let offset = 0;
for (const file of walk(OUT).sort()) {
  const name = Buffer.from(path.relative(OUT, file).split(path.sep).join('/'));
  const data = fs.readFileSync(file), packed = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
  head.writeUInt32LE(0, 10); head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(packed.length, 20); cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
  parts.push(head, name, packed); central.push(cen, name);
  offset += head.length + name.length + packed.length;
}
const cenSize = central.reduce((a, b) => a + b.length, 0), count = central.length / 2;
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
const zip = path.join(DIST, `topple-${portal}.zip`);
fs.writeFileSync(zip, Buffer.concat([...parts, ...central, end]));
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`${portal}: ${count} datoteka u dist/${portal}/, ${path.relative(process.cwd(), zip)} ${kb(fs.statSync(zip).size)}`);
