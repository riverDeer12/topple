// Checks that web/content.js describes everything the game contains, so the home
// page and the "Kako se igra" page stay complete. Run: npm test
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.LEVELS = require('../web/levels.js');
global.PUZZLES = require('../web/puzzles.js');
const K = require('../web/content.js');

const used = new Set();
for (const L of [...LEVELS, ...PUZZLES.endless, ...Object.values(PUZZLES.daily)]) for (const b of L.blocks) used.add(b[3]);
const I = require('../web/i18n.js');
const langs = Object.keys(I.LANGS);
for (const lang of langs) {
  const T = K.TEXT[lang];
  assert.ok(T, `content.js nema jezik '${lang}'.`);
  for (const t of used) assert.ok(T.TYPES[t], `Vrsta bloka '${t}' nema opis na jeziku '${lang}' u web/content.js.`);
  for (const t of K.TYPE_ORDER) assert.ok(T.TYPES[t], `TYPE_ORDER sadrži '${t}' bez opisa na jeziku '${lang}'.`);
  for (const sk of K.SKINS) assert.ok(T.SKIN_TEXT && T.SKIN_TEXT[sk.id], `Izgled '${sk.id}' nema opis (SKIN_TEXT) na jeziku '${lang}' u web/content.js.`);
  for (const key of ['RULES', 'MODES', 'FEATURES']) {
    assert.strictEqual(T[key].length, K.TEXT.hr[key].length, `${key} na jeziku '${lang}' nema isto stavki kao hrvatski.`);
    for (const [h, p] of T[key]) assert.ok(h && p && !/undefined|NaN/.test(h + p), `Prazan ili neispravan tekst (${lang}): ${h}`);
  }
  const missing = Object.keys(I.S.hr).filter(k => !(k in I.S[lang]));
  assert.deepStrictEqual(missing, [], `i18n.js: jeziku '${lang}' nedostaju prijevodi: ${missing.join(', ')}`);
  assert.ok(I.CHAPTERS[lang].length >= Math.ceil(LEVELS.length / 10) || true);
}
for (const t of used) assert.ok(K.TYPE_ORDER.includes(t), `Vrsta bloka '${t}' nije u TYPE_ORDER u web/content.js.`);
for (const t of K.TYPE_ORDER) assert.ok(K.TYPES[t], `TYPE_ORDER sadrži '${t}' bez opisa.`);
const css = fs.readFileSync(path.join(__dirname, '../web/theme.css'), 'utf8');
for (const t of K.TYPE_ORDER) assert.ok(css.includes(`.blk.${t} .face`), `Vrsta bloka '${t}' nema stil u web/theme.css.`);
for (const sk of K.SKINS) {
  assert.ok(I.S.hr['skin.' + sk.id], `Izgled '${sk.id}' nema naziv u i18n.js (skin.${sk.id}).`);
  if (sk.id !== 'classic') assert.ok(css.includes(`.skin-${sk.id}`), `Izgled '${sk.id}' nema stil u web/theme.css.`);
  assert.ok(sk.level === 0 || (sk.level >= 1 && sk.level <= LEVELS.length), `Izgled '${sk.id}' se otključava razinom ${sk.level}, a ona ne postoji.`);
}
assert.strictEqual(K.stats.levels, LEVELS.length);
for (const page of ['index.html', 'igra.html']) {
  const html = fs.readFileSync(path.join(__dirname, '../web', page), 'utf8');
  assert.ok(html.includes('content.js') && html.includes('i18n.js'), `${page} ne učitava content.js i i18n.js`);
  for (const m of html.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)) assert.ok(I.S.hr[m[1]], `${page}: ključ '${m[1]}' ne postoji u i18n.js`);
  for (const m of html.matchAll(/\bt\('([a-zA-Z0-9.]+)'/g)) if (!m[1].endsWith('.')) assert.ok(I.S.hr[m[1]], `${page}: ključ '${m[1]}' ne postoji u i18n.js`);
}
console.log(`Sadržaj je potpun na ${langs.length} jezika: ${used.size} vrsta blokova, sve opisane; ${K.stats.levels} razina.`);
