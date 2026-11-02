// Shared game logic (no DOM). Blocks: {x, y, w, t, d?, g?}
//   t: 'r' red (goal), 'n' normal, 'i' ice, 'f' fixed stone,
//      'h' heavy (breaks fragile blocks it falls onto), 'k' fragile, 'b' balloon (rises),
//      'a' arrow (slides only in direction d: 1 right, -1 left),
//      's' spring (fixed like stone; a block that slides into it bounces back to the far end)
//   g: true once a block is destroyed (fragile broken by heavy). Destroyed blocks
//      stay in the array so indices stay stable for the UI and undo history.
const W = 6, H = 8;
const FALLS = t => t !== 'f' && t !== 'b' && t !== 's';
const FIXED = t => t === 'f' || t === 's';
// Level data [x, y, w, t, d?] -> block objects.
const fromLevel = blocks => blocks.map(([x, y, w, t, d]) => (d ? { x, y, w, t, d } : { x, y, w, t }));
function grid(bs) {
  const g = Array.from({ length: H }, () => new Array(W).fill(-1));
  bs.forEach((b, i) => { if (!b.g) for (let k = 0; k < b.w; k++) g[b.y][b.x + k] = i; });
  return g;
}
function rowFree(g, y, b) {
  if (y < 0 || y >= H) return false;
  for (let k = 0; k < b.w; k++) if (g[y][b.x + k] !== -1) return false;
  return true;
}
// Gravity. Each round: everything that falls drops one row (lowest first), then
// balloons rise one row (highest first). Repeat until nothing moves.
// A heavy block that has fallen at least one row breaks every fragile block it
// lands on, then keeps falling. `events` (optional) collects breaks for animation:
// { broken, by, y } where y is the row the heavy block was on when it broke it.
function settle(bs, events) {
  const fell = bs.map(() => 0);
  const g = grid(bs); // kept in sync as blocks move, cheaper than rebuilding
  const fill = (b, v) => { for (let k = 0; k < b.w; k++) g[b.y][b.x + k] = v; };
  const down = bs.map((b, i) => i).filter(i => !bs[i].g && FALLS(bs[i].t));
  const up = bs.map((b, i) => i).filter(i => !bs[i].g && bs[i].t === 'b');
  let changed = true;
  while (changed) {
    changed = false;
    down.sort((a, b) => bs[b].y - bs[a].y);
    for (const i of down) {
      const b = bs[i];
      if (b.g) continue;
      if (b.t === 'h' && fell[i] > 0 && b.y + 1 < H) {
        for (let k = 0; k < b.w; k++) {
          const j = g[b.y + 1][b.x + k];
          if (j !== -1 && bs[j].t === 'k') {
            fill(bs[j], -1);
            bs[j].g = true;
            if (events) events.push({ broken: j, by: i, y: b.y });
            changed = true;
          }
        }
      }
      if (rowFree(g, b.y + 1, b)) { fill(b, -1); b.y++; fill(b, i); fell[i]++; changed = true; }
    }
    up.sort((a, b) => bs[a].y - bs[b].y);
    for (const i of up) {
      const b = bs[i];
      if (rowFree(g, b.y - 1, b)) { fill(b, -1); b.y--; fill(b, i); changed = true; }
    }
  }
  return bs;
}
function range(bs, i) { // how far block i can slide left / right
  const g = grid(bs), b = bs[i];
  if (b.g || FIXED(b.t)) return [0, 0];
  let l = 0, r = 0;
  while (b.x - l - 1 >= 0 && g[b.y][b.x - l - 1] === -1) l++;
  while (b.x + b.w + r < W && g[b.y][b.x + b.w + r] === -1) r++;
  if (b.t === 'a') return b.d > 0 ? [0, r] : [l, 0];
  return [l, r];
}
// Where block i ends up when slid by dx: if it stops against a spring, it bounces
// back and slides the other way as far as it can (once). Returns { x, hit } where
// hit is the x at which it touched the spring (undefined without a bounce).
function slide(bs, i, dx) {
  const b = bs[i], x = b.x + dx, dir = Math.sign(dx);
  const c = dir > 0 ? x + b.w : x - 1;
  if (!dir || c < 0 || c >= W) return { x };
  const g = grid(bs), j = g[b.y][c];
  if (j === -1 || bs[j].t !== 's') return { x };
  let nx = x;
  for (;;) {
    const n = dir > 0 ? nx - 1 : nx + b.w; // next cell in the bounce direction
    if (n < 0 || n >= W || (g[b.y][n] !== -1 && g[b.y][n] !== i)) break;
    nx -= dir;
  }
  return { x: nx, hit: x };
}
function won(bs, exitRow) {
  const r = bs.find(b => b.t === 'r');
  return r.y === exitRow && r.x + r.w === W;
}
function key(bs) { return bs.map(b => b.g ? 'x' : b.x + ',' + b.y).join(';'); }
function moves(bs) {
  const out = [];
  bs.forEach((b, i) => {
    if (FIXED(b.t) || b.g) return;
    const [l, r] = range(bs, i);
    if (b.t === 'i') { if (l) out.push([i, -l]); if (r) out.push([i, r]); }
    else { for (let d = 1; d <= l; d++) out.push([i, -d]); for (let d = 1; d <= r; d++) out.push([i, d]); }
  });
  return out;
}
function apply(bs, m) {
  const n = bs.map(b => ({ ...b }));
  n[m[0]].x = slide(bs, m[0], m[1]).x;
  return settle(n);
}
function solve(start, exitRow, maxStates = 200000) {
  if (won(start, exitRow)) return 0;
  const seen = new Set([key(start)]);
  let frontier = [start], depth = 0;
  while (frontier.length) {
    depth++;
    const next = [];
    for (const s of frontier) {
      for (const m of moves(s)) {
        const n = apply(s, m);
        const k = key(n);
        if (seen.has(k)) continue;
        if (won(n, exitRow)) return depth;
        seen.add(k);
        next.push(n);
        if (seen.size > maxStates) return -2;
      }
    }
    frontier = next;
  }
  return -1;
}
// Shortest solution as a list of moves [[block, dx], ...] (used for hints).
// Returns [] if already won, null if unsolvable or over the state budget.
function solvePath(start, exitRow, maxStates = 600000) {
  if (won(start, exitRow)) return [];
  const startKey = key(start);
  const prev = new Map([[startKey, null]]); // state key -> [parent key, move]
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      const sk = key(s);
      for (const m of moves(s)) {
        const n = apply(s, m), k = key(n);
        if (prev.has(k)) continue;
        prev.set(k, [sk, m]);
        if (won(n, exitRow)) {
          const path = [];
          for (let c = k; c !== startKey; c = prev.get(c)[0]) path.unshift(prev.get(c)[1]);
          return path;
        }
        next.push(n);
        if (prev.size > maxStates) return null;
      }
    }
    frontier = next;
  }
  return null;
}
if (typeof module !== 'undefined') module.exports = { W, H, grid, settle, range, slide, won, moves, apply, solve, solvePath, key, fromLevel };
