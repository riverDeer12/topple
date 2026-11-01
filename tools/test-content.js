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
for (const t of used) {
  assert.ok(K.TYPES[t], `Vrsta bloka '${t}' se koristi u razinama, ali nema opis u web/content.js (TYPES).`);
  assert.ok(K.TYPE_ORDER.includes(t), `Vrsta bloka '${t}' nije u TYPE_ORDER u web/content.js.`);
}
for (const t of K.TYPE_ORDER) assert.ok(K.TYPES[t], `TYPE_ORDER sadrži '${t}' bez opisa.`);
const css = fs.readFileSync(path.join(__dirname, '../web/theme.css'), 'utf8');
for (const t of K.TYPE_ORDER) assert.ok(css.includes(`.blk.${t} .face`), `Vrsta bloka '${t}' nema stil u web/theme.css.`);
for (const list of [K.RULES, K.MODES, K.FEATURES]) for (const [h, p] of list) assert.ok(h && p && !/undefined|NaN/.test(h + p), `Prazan ili neispravan tekst: ${h}`);
assert.strictEqual(K.stats.levels, LEVELS.length);
for (const page of ['index.html', 'igra.html']) {
  assert.ok(fs.readFileSync(path.join(__dirname, '../web', page), 'utf8').includes('content.js'), `${page} ne učitava content.js`);
}
console.log(`Sadržaj je potpun: ${used.size} vrsta blokova u igri, sve opisane; ${K.stats.levels} razina.`);
