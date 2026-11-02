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
const G = require('../web/gen.js');

const args = process.argv.slice(2);
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? new Set(args.splice(onlyAt, 2)[1].split(',').map(n => Number(n) - 1)) : null;
const BASE = Number(args[0] || 12345);
const INDEPENDENT_FROM = 10;
let seed = BASE;
// Legacy LCG for levels 1-10. seed * 1103515245 exceeds 2^53, so it loses
// precision and falls into a cycle of ~10k numbers; kept only so those levels
// stay the same. Independent levels use mulberry32 instead.
const lcg = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const mulberry32 = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let rnd = lcg;
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
  // Chapter 3 (21-30): target 5-7. Each chapter rotates stone/ice, heavy, balloon and mixed boards.
  { opt: 5, max: 6, n: 6, fixed: 1, ice: 1 },
  { opt: 5, max: 6, n: 5, fixed: 1, ice: 0, heavy: 1, fragile: 2 },
  { opt: 5, max: 6, n: 5, fixed: 1, ice: 1, balloon: 1 },
  { opt: 6, max: 7, n: 7, fixed: 2, ice: 1 },
  { opt: 6, max: 7, n: 5, fixed: 1, ice: 0, heavy: 1, fragile: 2 },
  { opt: 6, max: 7, n: 6, fixed: 1, ice: 1, balloon: 1 },
  { opt: 6, max: 7, n: 5, fixed: 1, ice: 0, heavy: 1, fragile: 1, balloon: 1 },
  { opt: 7, max: 8, n: 7, fixed: 1, ice: 2 },
  { opt: 7, max: 8, n: 6, fixed: 1, ice: 1, balloon: 2 },
  { opt: 7, max: 8, n: 6, fixed: 1, ice: 1, heavy: 1, fragile: 2 },
  // Chapter 4 (31-40): target 7-9.
  { opt: 7, max: 8, n: 8, fixed: 2, ice: 1 },
  { opt: 7, max: 8, n: 6, fixed: 2, ice: 0, heavy: 1, fragile: 2 },
  { opt: 7, max: 8, n: 7, fixed: 1, ice: 1, balloon: 1 },
  { opt: 7, max: 9, n: 6, fixed: 1, ice: 0, heavy: 1, fragile: 2, balloon: 1 },
  { opt: 8, max: 9, n: 8, fixed: 1, ice: 2 },
  { opt: 8, max: 9, n: 7, fixed: 1, ice: 1, heavy: 1, fragile: 2 },
  { opt: 8, max: 9, n: 7, fixed: 2, ice: 1, balloon: 2 },
  { opt: 8, max: 10, n: 6, fixed: 1, ice: 1, heavy: 1, fragile: 1, balloon: 1 },
  { opt: 8, max: 10, n: 8, fixed: 2, ice: 2 },
  { opt: 8, max: 10, n: 7, fixed: 1, ice: 1, heavy: 2, fragile: 2 },
  // Chapter 5 (41-50): target 8-10.
  { opt: 8, max: 10, n: 8, fixed: 1, ice: 1, balloon: 1 },
  { opt: 9, max: 10, n: 8, fixed: 2, ice: 1 },
  { opt: 8, max: 10, n: 7, fixed: 1, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
  { opt: 9, max: 10, n: 7, fixed: 2, ice: 1, heavy: 1, fragile: 2 },
  { opt: 9, max: 10, n: 8, fixed: 1, ice: 1, balloon: 2 },
  { opt: 9, max: 11, n: 9, fixed: 2, ice: 2 },
  { opt: 9, max: 11, n: 7, fixed: 1, ice: 1, heavy: 2, fragile: 2, balloon: 1 },
  { opt: 9, max: 11, n: 8, fixed: 1, ice: 2, heavy: 1, fragile: 2 },
  { opt: 9, max: 11, n: 8, fixed: 2, ice: 1, balloon: 1 },
  { opt: 10, max: 11, n: 8, fixed: 1, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
  // Chapter 6 (51-60): target 9-12.
  { opt: 10, max: 12, n: 9, fixed: 2, ice: 1 },
  { opt: 10, max: 12, n: 8, fixed: 1, ice: 1, heavy: 1, fragile: 2 },
  { opt: 10, max: 12, n: 8, fixed: 1, ice: 1, balloon: 2 },
  { opt: 10, max: 12, n: 7, fixed: 2, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
  { opt: 10, max: 12, n: 9, fixed: 1, ice: 2 },
  { opt: 10, max: 12, n: 8, fixed: 2, ice: 1, heavy: 2, fragile: 3 },
  { opt: 11, max: 13, n: 8, fixed: 1, ice: 2, balloon: 2 },
  // 58-60 were widened (and 58-59 slimmed down) after hours without a match at the first targets.
  { opt: 10, max: 13, n: 7, fixed: 1, ice: 1, heavy: 1, fragile: 2 },
  { opt: 10, max: 14, n: 8, fixed: 2, ice: 2 },
  { opt: 11, max: 16, n: 8, fixed: 1, ice: 1, heavy: 1, fragile: 2, balloon: 1 },
];

const make = spec => G.make(spec, ri);
const needs = G.needs;

const CACHE = path.join(__dirname, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = (i, s, seedIn) => path.join(CACHE, `level-${i + 1}-${i >= INDEPENDENT_FROM ? 'm' : ''}${seedIn}-${Buffer.from(JSON.stringify(s)).toString('base64url').slice(0, 40)}.json`);

const search = s => G.search(s, ri);

const out = [];
for (let i = 0; i < SPECS.length; i++) {
  const s = SPECS[i];
  if (i >= INDEPENDENT_FROM) { seed = (BASE + i * 7919) % 2147483648; rnd = mulberry32; }
  const seedIn = seed, file = cacheFile(i, s, seedIn);
  if (fs.existsSync(file)) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    seed = c.seedOut;
    out.push(c.level);
    console.log(`Razina ${i + 1}: cilj ${c.level.opt} (iz cachea)`);
    continue;
  }
  if (only && !only.has(i)) {
    // A missing shared-stream level only matters if a later shared-stream level is wanted.
    if ([...only].some(j => j > i && j < INDEPENDENT_FROM)) { console.error(`Razina ${i + 1} nije u cacheu, a o njoj ovise kasnije razine.`); process.exit(1); }
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
