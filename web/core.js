// Shared game logic. Blocks: {x,y,w,t} t: 'r' red, 'n' normal, 'i' ice, 'f' fixed
const W = 6, H = 8;
function grid(bs) {
  const g = Array.from({ length: H }, () => new Array(W).fill(-1));
  bs.forEach((b, i) => { for (let k = 0; k < b.w; k++) g[b.y][b.x + k] = i; });
  return g;
}
function settle(bs) {
  let changed = true;
  while (changed) {
    changed = false;
    const order = bs.map((b, i) => i).filter(i => bs[i].t !== 'f').sort((a, b) => bs[b].y - bs[a].y);
    for (const i of order) {
      const b = bs[i];
      if (b.y + 1 >= H) continue;
      const g = grid(bs);
      let free = true;
      for (let k = 0; k < b.w; k++) if (g[b.y + 1][b.x + k] !== -1) { free = false; break; }
      if (free) { b.y++; changed = true; }
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
function key(bs) { return bs.map(b => b.x + ',' + b.y).join(';'); }
function moves(bs) {
  const out = [];
  bs.forEach((b, i) => {
    if (b.t === 'f') return;
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
