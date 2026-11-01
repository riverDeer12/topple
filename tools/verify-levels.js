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
if (bad) { console.error(`${bad} razina ne prolazi provjeru.`); process.exit(1); }
console.log('Sve razine su rješive i imaju točan cilj.');
