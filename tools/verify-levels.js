// Re-solves every level and checks that the stored `opt` is the true minimum.
// Run: npm run verify
const C = require('../web/core.js');
const LEVELS = require('../web/levels.js');

let bad = 0;
LEVELS.forEach((L, i) => {
  const blocks = L.blocks.map(([x, y, w, t]) => ({ x, y, w, t }));
  const settled = C.key(C.settle(blocks.map(b => ({ ...b })))) === C.key(blocks);
  const opt = C.solve(blocks, L.exit, 500000);
  const ok = settled && opt === L.opt;
  if (!ok) bad++;
  console.log(`Razina ${String(i + 1).padStart(2)}  cilj ${L.opt}  solver ${opt}  ${settled ? '' : 'NESTABILNA '}${ok ? 'OK' : 'GREŠKA'}`);
});
// Pre-generated daily and endless puzzles (web/puzzles.js).
const PUZZLES = require('../web/puzzles.js');
const puzzles = [...PUZZLES.endless.map((l, i) => ['beskonačna ' + (i + 1), l]), ...Object.entries(PUZZLES.daily).map(([d, l]) => ['dnevna ' + d, l])];
let badP = 0;
for (const [name, L] of puzzles) {
  const blocks = L.blocks.map(([x, y, w, t]) => ({ x, y, w, t }));
  const settled = C.key(C.settle(blocks.map(b => ({ ...b })))) === C.key(blocks);
  const opt = C.solve(blocks, L.exit, 500000);
  if (!settled || opt !== L.opt) { badP++; console.log(`Zagonetka ${name}  cilj ${L.opt}  solver ${opt}  GREŠKA`); }
}
console.log(`Zagonetke: ${puzzles.length - badP} od ${puzzles.length} u redu.`);
bad += badP;
if (bad) { console.error(`${bad} razina ili zagonetki ne prolazi provjeru.`); process.exit(1); }
console.log('Sve razine su rješive i imaju točan cilj.');
