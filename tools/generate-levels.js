// Generates levels by random placement + BFS solver, picking boards whose
// optimal solution length matches each spec. Writes web/levels.js.
// Run: npm run generate                      (default seed)
//      node tools/generate-levels.js 777          (custom seed)
//      node tools/generate-levels.js --only 18,19 (search only these levels, 1-based;
//                                                   run several in parallel, then a plain run)
// Every found level is cached in tools/.cache/, keyed by spec and seed, so an
// interrupted run keeps its progress and a plain run reuses the cache.
// Levels 1-10 share one random stream (kept so they stay as they were); from
// level 11 on each level has its own seed and can be searched independently.
const fs = require('fs');
const path = require('path');
const C = require('../web/core.js');
const { W, H } = C;

const args = process.argv.slice(2);
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? new Set(args.splice(onlyAt, 2)[1].split(',').map(n => Number(n) - 1)) : null;
const BASE = Number(args[0] || 12345);
const INDEPENDENT_FROM = 10;
let seed = BASE;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// Difficulty curve. opt = required optimal moves (max = accept a range).
const SPECS = [
  { opt: 2, n: 3, fixed: 0, ice: 0 },
  { opt: 3, n: 4, fixed: 0, ice: 0 },
  { opt: 3, n: 5, fixed: 1, ice: 0 },
  { opt: 4, n: 6, fixed: 1, ice: 0 },
  { opt: 5, n: 7, fixed: 1, ice: 0 },
  { opt: 4, n: 6, fixed: 1, ice: 1 },
  { opt: 5, n: 7, fixed: 2, ice: 1 },
  { opt: 6, n: 8, fixed: 1, ice: 2 },
  { opt: 7, n: 8, fixed: 2, ice: 2 },
  { opt: 8, max: 10, n: 8, fixed: 2, ice: 1 },
  // Heavy + fragile. Specs with heavy/balloon must actually need the mechanic:
  // turning those blocks into normal ones has to change the optimal solution.
  { opt: 3, n: 3, fixed: 0, ice: 0, heavy: 1, fragile: 1 },
  { opt: 4, n: 4, fixed: 1, ice: 0, heavy: 1, fragile: 2 },
  { opt: 5, n: 5, fixed: 1, ice: 1, heavy: 1, fragile: 2 },
  // Balloons.
  { opt: 3, n: 4, fixed: 0, ice: 0, balloon: 1 },
  { opt: 4, n: 5, fixed: 1, ice: 0, balloon: 1 },
  { opt: 5, n: 6, fixed: 1, ice: 1, balloon: 2 },
  // Everything together.
  { opt: 6, n: 5, fixed: 1, ice: 0, heavy: 1, fragile: 1, balloon: 1 },
  { opt: 7, max: 8, n: 7, fixed: 1, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
  { opt: 8, max: 9, n: 7, fixed: 2, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
  { opt: 9, max: 12, n: 8, fixed: 1, ice: 1, heavy: 1, fragile: 2, balloon: 2 },
];

function tryPlace(bs, b) {
  const g = C.grid(bs);
  for (let k = 0; k < b.w; k++) if (b.x + k >= W || g[b.y][b.x + k] !== -1) return false;
  bs.push(b);
  return true;
}

function make(spec) {
  const bs = [];
  for (let f = 0; f < spec.fixed; f++) {
    for (let t = 0; t < 50; t++) { const w = ri(1, 2); if (tryPlace(bs, { x: ri(0, W - w), y: ri(3, H - 2), w, t: 'f' })) break; }
  }
  for (let t = 0; t < 50; t++) if (tryPlace(bs, { x: ri(0, W - 2), y: ri(0, 1), w: 2, t: 'r' })) break;
  if (!bs.find(b => b.t === 'r')) return null;
  // Special blocks. Loops only run when the spec asks for them, so older specs
  // consume the same random numbers as before and keep their levels.
  const extra = [['h', spec.heavy, 0, 3], ['k', spec.fragile, 3, H - 1], ['b', spec.balloon, 3, H - 1]];
  for (const [t, count, y0, y1] of extra) {
    for (let c = 0; c < (count || 0); c++) {
      for (let a = 0; a < 50; a++) { const w = ri(1, 3); if (tryPlace(bs, { x: ri(0, W - w), y: ri(y0, y1), w, t })) break; }
    }
  }
  let ice = spec.ice;
  for (let n = 0; n < spec.n; n++) {
    for (let t = 0; t < 50; t++) {
      const w = ri(1, 3);
      const typ = ice > 0 ? 'i' : 'n';
      if (tryPlace(bs, { x: ri(0, W - w), y: ri(1, H - 1), w, t: typ })) { if (typ === 'i') ice--; break; }
    }
  }
  C.settle(bs);
  if (bs.some(b => b.g)) return null; // nothing may break before the first move
  const red = bs.find(b => b.t === 'r');
  if (red.y >= H - 1) return null;
  const exitRow = ri(Math.max(red.y + 1, H - 4), H - 1);
  // The exit cell must be blocked at the start so the player has to work for it.
  if (C.grid(bs)[exitRow][W - 1] === -1) return null;
  return { bs, exitRow };
}

// True if the level gets a different optimum when blocks of type t act as normal blocks.
function needs(start, exitRow, opt, t) {
  const plain = C.settle(start.map(b => ({ ...b, t: b.t === t ? 'n' : b.t })));
  if (plain.some(b => b.g)) return true;
  return C.solve(plain, exitRow, 60000) !== opt;
}

const CACHE = path.join(__dirname, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = (i, s, seedIn) => path.join(CACHE, `level-${i + 1}-${seedIn}-${Buffer.from(JSON.stringify(s)).toString('base64url').slice(0, 40)}.json`);

function search(s) {
  let tries = 0;
  while (tries < 400000) {
    tries++;
    const L = make(s);
    if (!L) continue;
    const start = L.bs.map(b => ({ ...b }));
    const o = C.solve(L.bs.map(b => ({ ...b })), L.exitRow, 60000);
    if (o < s.opt || o > (s.max || s.opt)) continue;
    if (s.ice && !C.moves(start).some(m => start[m[0]].t === 'i')) continue;
    if ((s.heavy && !needs(start, L.exitRow, o, 'h')) || (s.balloon && !needs(start, L.exitRow, o, 'b'))) continue;
    return { level: { exit: L.exitRow, opt: o, blocks: start.map(b => [b.x, b.y, b.w, b.t]) }, tries };
  }
  return { level: null, tries };
}

const out = [];
for (let i = 0; i < SPECS.length; i++) {
  const s = SPECS[i];
  if (i >= INDEPENDENT_FROM) seed = (BASE + i * 7919) % 2147483648;
  const seedIn = seed, file = cacheFile(i, s, seedIn);
  if (fs.existsSync(file)) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    seed = c.seedOut;
    out.push(c.level);
    console.log(`Razina ${i + 1}: cilj ${c.level.opt} (iz cachea)`);
    continue;
  }
  if (only && !only.has(i)) {
    if (i < INDEPENDENT_FROM) { console.error(`Razina ${i + 1} nije u cacheu, a o njoj ovise kasnije razine.`); process.exit(1); }
    out.push(null);
    continue;
  }
  const t0 = Date.now();
  const { level, tries } = search(s);
  if (!level) { console.error(`Nema razine ${i + 1} za cilj ${s.opt} nakon ${tries} pokušaja.`); process.exit(1); }
  fs.writeFileSync(file, JSON.stringify({ seedOut: seed, level }));
  console.log(`Razina ${i + 1}: cilj ${level.opt} (${tries} pokušaja, ${Math.round((Date.now() - t0) / 1000)} s)`);
  out.push(level);
}
if (out.includes(null)) { console.log('Tražene razine su spremljene u cache. Pokreni bez --only za zapis u web/levels.js.'); process.exit(0); }

const body = out.map(l => '  ' + JSON.stringify(l)).join(',\n');
fs.writeFileSync(path.join(__dirname, '../web/levels.js'),
  '// Generated by tools/generate-levels.js, verified by tools/verify-levels.js.\n' +
  '// Block format: [x, y, width, type]  type: r = red, n = normal, i = ice, f = fixed stone,\n' +
  '//   h = heavy, k = fragile, b = balloon\n' +
  'const LEVELS = [\n' + body + '\n];\nif (typeof module !== "undefined") module.exports = LEVELS;\n');
console.log('Zapisano u web/levels.js');
