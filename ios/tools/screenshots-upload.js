#!/usr/bin/env node
// Uploads App Store screenshots for the version being prepared, for all four languages.
// Put PNGs from the simulator (⌘S) in ios/screenshots/ (used for every language) or in
// ios/screenshots/<locale>/ (hr, en-US, it, de-DE) for one language. The display type is
// found from the image size; files are uploaded in name order (01.png, 02.png, ...).
//
//   node ios/tools/screenshots-upload.js --dry-run
//   node ios/tools/screenshots-upload.js --key AuthKey_X.p8 --key-id X --issuer xxxx [--replace]
//
// Without --replace a language that already has screenshots of that size is left alone;
// with --replace its screenshots are deleted and uploaded again.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { arg, api, all, rel, appByBundle } = require('./asc.js');

const DRY = process.argv.includes('--dry-run'), REPLACE = process.argv.includes('--replace');
const BUNDLE = arg('bundle') || 'software.rdd.topple';
const DIR = path.resolve(arg('dir') || path.join(__dirname, '..', 'screenshots'));
const LOCALES = ['hr', 'en-US', 'it', 'de-DE'];
// Accepted sizes (portrait or landscape) → App Store Connect display type.
const TYPES = [
  [[1320, 2868], [1290, 2796], [1260, 2736], 'APP_IPHONE_67'],          // 6.9" / 6.7"
  [[1284, 2778], [1242, 2688], 'APP_IPHONE_65'],                       // 6.5"
  [[2064, 2752], [2048, 2732], 'APP_IPAD_PRO_3GEN_129'],               // iPad 13"
];
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: nije PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function typeOf(file) {
  const [w, h] = pngSize(file), [a, b] = [Math.min(w, h), Math.max(w, h)];
  const t = TYPES.find(row => row.slice(0, -1).some(([x, y]) => x === a && y === b));
  if (!t) throw new Error(`${path.basename(file)}: veličina ${w}×${h} nije podržana (iPhone 6,9" 1320×2868, iPad 13" 2064×2752)`);
  return arg('type') || t[t.length - 1];
}
// { locale: { displayType: [files] } }
function plan() {
  if (!fs.existsSync(DIR)) throw new Error(`Nema mape ${DIR}. Spremi snimke (PNG) u nju.`);
  const pngs = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => /\.png$/i.test(f)).sort().map(f => path.join(d, f)) : [];
  const shared = pngs(DIR), out = {};
  for (const loc of LOCALES) {
    const files = pngs(path.join(DIR, loc)).length ? pngs(path.join(DIR, loc)) : shared;
    out[loc] = {};
    for (const f of files) (out[loc][typeOf(f)] = out[loc][typeOf(f)] || []).push(f);
    for (const [t, list] of Object.entries(out[loc])) if (list.length > 10) throw new Error(`${loc} ${t}: najviše 10 snimki, a ima ${list.length}`);
  }
  if (!Object.values(out).some(x => Object.keys(x).length)) throw new Error(`U ${DIR} nema PNG snimki.`);
  return out;
}

async function upload(setId, file) {
  const data = fs.readFileSync(file);
  const r = await api('POST', '/v1/appScreenshots', {
    data: { type: 'appScreenshots', attributes: { fileName: path.basename(file), fileSize: data.length }, relationships: { appScreenshotSet: rel('appScreenshotSets', setId) } },
  });
  for (const op of r.data.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map(h => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: data.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload ${path.basename(file)} → HTTP ${res.status}`);
  }
  await api('PATCH', '/v1/appScreenshots/' + r.data.id, {
    data: { type: 'appScreenshots', id: r.data.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(data).digest('hex') } },
  });
}

(async () => {
  const p = plan();
  for (const loc of LOCALES) for (const [t, files] of Object.entries(p[loc])) console.log(`${loc.padEnd(6)} ${t.padEnd(22)} ${files.map(f => path.basename(f)).join(', ')}`);
  if (DRY) return;

  const app = await appByBundle(BUNDLE);
  const versions = await all(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`);
  const version = versions.find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState || v.attributes.appVersionState));
  if (!version) throw new Error('Nema verzije u pripremi (Prepare for Submission).');
  const locs = await all(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  console.log(`\nAplikacija ${BUNDLE}, verzija ${version.attributes.versionString}`);

  for (const loc of LOCALES) {
    const vl = locs.find(x => x.attributes.locale === loc);
    if (!vl) { console.log(`  ${loc}: jezik ne postoji u verziji (prvo pokreni appstore-upload.js), preskačem`); continue; }
    const sets = await all(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`);
    for (const [t, files] of Object.entries(p[loc])) {
      let set = sets.find(s => s.attributes.screenshotDisplayType === t);
      if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: t }, relationships: { appStoreVersionLocalization: rel('appStoreVersionLocalizations', vl.id) } } })).data;
      const old = await all(`/v1/appScreenshotSets/${set.id}/appScreenshots`);
      if (old.length && !REPLACE) { console.log(`  ${loc} ${t}: već ima ${old.length} snimki, preskačem (--replace za zamjenu)`); continue; }
      for (const s of old) await api('DELETE', '/v1/appScreenshots/' + s.id);
      for (const f of files) await upload(set.id, f);
      console.log(`  ${loc} ${t}: ${files.length} snimki`);
    }
  }
  console.log('\nGotovo. Apple obradi snimke za minutu-dvije; provjeri ih na stranici verzije.');
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
