// Puzzle generation shared by the game (browser + worker), the API server and
// tools/generate-levels.js. Deterministic: the same seed and spec always give
// the same board, so the daily puzzle and endless puzzle #n are identical for
// every player and the server can regenerate them to check submitted solutions.
(function (root) {
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js')
    : { W, H, grid, settle, solve, moves }; // core.js globals in the browser / worker
  const { W: GW, H: GH } = C;

  // mulberry32 PRNG. Returns { rnd, ri } bound to its own state.
  function rng(seed) {
    let s = seed | 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { rnd, ri: (a, b) => a + Math.floor(rnd() * (b - a + 1)) };
  }
  // FNV-1a string hash -> 32-bit seed.
  function hashSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  function tryPlace(bs, b) {
    const g = C.grid(bs);
    for (let k = 0; k < b.w; k++) if (b.x + k >= GW || g[b.y][b.x + k] !== -1) return false;
    bs.push(b);
    return true;
  }

  // One random board for a spec, or null. `ri(a, b)` is the random int source.
  // The order of random calls must not change: tools/generate-levels.js relies
  // on it to reproduce levels 1-20.
  function make(spec, ri) {
    const bs = [];
    for (let f = 0; f < spec.fixed; f++) {
      for (let t = 0; t < 50; t++) { const w = ri(1, 2); if (tryPlace(bs, { x: ri(0, GW - w), y: ri(3, GH - 2), w, t: 'f' })) break; }
    }
    for (let t = 0; t < 50; t++) if (tryPlace(bs, { x: ri(0, GW - 2), y: ri(0, 1), w: 2, t: 'r' })) break;
    if (!bs.find(b => b.t === 'r')) return null;
    // Special blocks only consume random numbers when the spec asks for them.
    const extra = [['h', spec.heavy, 0, 3], ['k', spec.fragile, 3, GH - 1], ['b', spec.balloon, 3, GH - 1]];
    for (const [t, count, y0, y1] of extra) {
      for (let c = 0; c < (count || 0); c++) {
        for (let a = 0; a < 50; a++) { const w = ri(1, 3); if (tryPlace(bs, { x: ri(0, GW - w), y: ri(y0, y1), w, t })) break; }
      }
    }
    let ice = spec.ice;
    for (let n = 0; n < spec.n; n++) {
      for (let t = 0; t < 50; t++) {
        const w = ri(1, 3);
        const typ = ice > 0 ? 'i' : 'n';
        if (tryPlace(bs, { x: ri(0, GW - w), y: ri(1, GH - 1), w, t: typ })) { if (typ === 'i') ice--; break; }
      }
    }
    C.settle(bs);
    if (bs.some(b => b.g)) return null; // nothing may break before the first move
    const red = bs.find(b => b.t === 'r');
    if (red.y >= GH - 1) return null;
    const exitRow = ri(Math.max(red.y + 1, GH - 4), GH - 1);
    // The exit cell must be blocked at the start so the player has to work for it.
    if (C.grid(bs)[exitRow][GW - 1] === -1) return null;
    return { bs, exitRow };
  }

  // True if the level gets a different optimum when blocks of type t act as normal blocks.
  function needs(start, exitRow, opt, t, maxStates) {
    const plain = C.settle(start.map(b => ({ ...b, t: b.t === t ? 'n' : b.t })));
    if (plain.some(b => b.g)) return true;
    return C.solve(plain, exitRow, maxStates) !== opt;
  }

  // Try random boards until one matches the spec. Deterministic for a given ri.
  function search(spec, ri, { maxStates = 60000, maxTries = 400000 } = {}) {
    let tries = 0;
    while (tries < maxTries) {
      tries++;
      const L = make(spec, ri);
      if (!L) continue;
      const start = L.bs.map(b => ({ ...b }));
      const o = C.solve(L.bs.map(b => ({ ...b })), L.exitRow, maxStates);
      if (o < spec.opt || o > (spec.max || spec.opt)) continue;
      if (spec.ice && !C.moves(start).some(m => start[m[0]].t === 'i')) continue;
      if ((spec.heavy && !needs(start, L.exitRow, o, 'h', maxStates)) || (spec.balloon && !needs(start, L.exitRow, o, 'b', maxStates))) continue;
      return { level: { exit: L.exitRow, opt: o, blocks: start.map(b => [b.x, b.y, b.w, b.t]) }, tries };
    }
    return { level: null, tries };
  }

  // In-game puzzles use a smaller state budget so a phone finds them in seconds.
  const GAME = { maxStates: 25000, maxTries: 20000 };

  // Endless mode: one shared sequence for everyone, puzzle n (1-based) gets
  // harder as n grows and cycles through the mechanics.
  function endlessSpec(n) {
    const tier = Math.min(4, Math.floor((n - 1) / 5)); // 0..4, every 5 puzzles
    const opt = [3, 4, 4, 5, 5][tier], max = [4, 5, 6, 6, 7][tier];
    const flavor = n % 4; // 0 plain+ice, 1 heavy, 2 balloon, 3 mixed
    const s = { opt, max, n: 4 + Math.min(2, tier), fixed: tier > 0 ? 1 : 0, ice: flavor === 0 && tier > 0 ? 1 : 0 };
    if (flavor === 1 || flavor === 3) { s.heavy = 1; s.fragile = 1 + (tier > 2 ? 1 : 0); }
    if (flavor === 2 || flavor === 3) s.balloon = 1;
    return s;
  }
  // If a spec finds nothing within GAME.maxTries, retry with a wider range and a
  // new seed. Still deterministic, so every device and the server agree.
  function seeded(spec, key) {
    for (let k = 0; k < 4; k++) {
      const s = { ...spec, max: (spec.max || spec.opt) + k };
      const r = search(s, rng(hashSeed(key + (k ? ':' + k : ''))).ri, GAME);
      if (r.level) return r;
    }
    return { level: null };
  }
  function endlessPuzzle(n) { return seeded(endlessSpec(n), 'endless:' + n); }

  // Daily puzzle: the same board for everyone on a given date (YYYY-MM-DD, Europe/Zagreb).
  function dailySpec(date) {
    const day = new Date(date + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
    const s = { opt: 5, max: 7, n: 5, fixed: 1, ice: 0 };
    if (day === 1 || day === 4) { s.ice = 1; }
    if (day === 2 || day === 5 || day === 0) { s.heavy = 1; s.fragile = 1; }
    if (day === 3 || day === 6 || day === 0) { s.balloon = 1; }
    if (day === 0) { s.opt = 6; s.max = 8; }
    return s;
  }
  function dailyPuzzle(date) { return seeded(dailySpec(date), 'daily:' + date); }
  function today(tz = 'Europe/Zagreb', now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }

  const api = { rng, hashSeed, tryPlace, make, needs, search, endlessSpec, endlessPuzzle, dailySpec, dailyPuzzle, today, GAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ToppleGen = api;
})(this);
