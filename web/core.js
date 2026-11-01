// Shared game logic (no DOM). Blocks: {x, y, w, t, g?}
//   t: 'r' red (goal), 'n' normal, 'i' ice, 'f' fixed stone,
//      'h' heavy (breaks fragile blocks it falls onto), 'k' fragile, 'b' balloon (rises)
//   g: true once a block is destroyed (fragile broken by heavy). Destroyed blocks
//      stay in the array so indices stay stable for the UI and undo history.
const W = 6, H = 8;
const FALLS = t => t !== 'f' && t !== 'b';
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
  let l = 0, r = 0;
  while (b.x - l - 1 >= 0 && g[b.y][b.x - l - 1] === -1) l++;
  while (b.x + b.w + r < W && g[b.y][b.x + b.w + r] === -1) r++;
  return [l, r];
}
function won(bs, exitRow) {
  const r = bs.find(b => b.t === 'r');
  return r.y === exitRow && r.x + r.w === W;
}
function key(bs) { return bs.map(b => b.g ? 'x' : b.x + ',' + b.y).join(';'); }
function moves(bs) {
  const out = [];
  bs.forEach((b, i) => {
    if (b.t === 'f' || b.g) return;
    const [l, r] = range(bs, i);
    if (b.t === 'i') { if (l) out.push([i, -l]); if (r) out.push([i, r]); }
    else { for (let d = 1; d <= l; d++) out.push([i, -d]); for (let d = 1; d <= r; d++) out.push([i, d]); }
  });
  return out;
}
function apply(bs, m) {
  const n = bs.map(b => ({ ...b }));
  n[m[0]].x += m[1];
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
if (typeof module !== 'undefined') module.exports = { W, H, grid, settle, range, won, moves, apply, solve, key };
