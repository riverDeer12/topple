// Small rule tests for web/core.js. Run: npm test
const assert = require('assert');
const C = require('../web/core.js');

const B = (x, y, w, t) => ({ x, y, w, t });
const tests = {
  'normal block falls to the floor'() {
    const bs = C.settle([B(0, 2, 2, 'n')]);
    assert.strictEqual(bs[0].y, 7);
  },
  'block rests if any cell is supported'() {
    const bs = C.settle([B(0, 7, 1, 'n'), B(0, 3, 3, 'n')]);
    assert.strictEqual(bs[1].y, 6);
  },
  'stone neither falls nor moves'() {
    const bs = [B(2, 3, 2, 'f')];
    C.settle(bs);
    assert.strictEqual(bs[0].y, 3);
    assert.deepStrictEqual(C.moves(bs), []);
  },
  'ice only slides all the way'() {
    const bs = [B(2, 7, 1, 'i')];
    assert.deepStrictEqual(C.moves(bs).map(m => m[1]).sort(), [-2, 3]);
  },
  'balloon rises to the ceiling'() {
    const bs = C.settle([B(1, 6, 2, 'b')]);
    assert.strictEqual(bs[0].y, 0);
  },
  'balloon stops under a stone'() {
    const bs = C.settle([B(1, 6, 2, 'b'), B(2, 2, 1, 'f')]);
    assert.strictEqual(bs[0].y, 3);
  },
  'balloon and a falling block meet: the block lands on the balloon'() {
    const bs = C.settle([B(0, 4, 2, 'b'), B(0, 2, 2, 'n')]);
    assert.strictEqual(bs[1].y, 3);
    assert.strictEqual(bs[0].y, 4);
  },
  'heavy block breaks a fragile block it falls onto'() {
    const ev = [];
    const bs = C.settle([B(0, 7, 2, 'k'), B(0, 3, 2, 'h')], ev);
    assert.strictEqual(bs[0].g, true);
    assert.strictEqual(bs[1].y, 7);
    assert.deepStrictEqual(ev, [{ broken: 0, by: 1, y: 6 }]);
  },
  'heavy block resting on a fragile block does not break it'() {
    const bs = C.settle([B(0, 7, 2, 'k'), B(0, 6, 2, 'h')]);
    assert.ok(!bs[0].g);
    assert.strictEqual(bs[1].y, 6);
  },
  'heavy block breaks fragile but stays on solid support beside it'() {
    const bs = C.settle([B(0, 7, 1, 'k'), B(1, 7, 1, 'n'), B(0, 4, 2, 'h')]);
    assert.ok(bs[0].g);
    assert.strictEqual(bs[2].y, 6);
  },
  'normal block does not break fragile'() {
    const bs = C.settle([B(0, 7, 2, 'k'), B(0, 3, 2, 'n')]);
    assert.ok(!bs[0].g);
    assert.strictEqual(bs[1].y, 6);
  },
  'broken blocks cannot move and do not block'() {
    const bs = [B(0, 7, 2, 'k'), B(2, 7, 1, 'n')];
    bs[0].g = true;
    assert.ok(C.moves(bs).every(m => m[0] !== 0));
    assert.deepStrictEqual(C.range(bs, 1), [2, 3]);
  },
  'sliding out from under a heavy block triggers a break chain'() {
    // heavy on a normal block on top of a fragile block; slide the normal away
    const bs = [B(0, 7, 2, 'k'), B(0, 6, 2, 'n'), B(0, 5, 2, 'h')];
    const n = C.apply(bs, [1, 3]);
    assert.ok(n[0].g);
    assert.strictEqual(n[2].y, 7);
  },
  'arrow slides only in its direction'() {
    const right = [{ x: 2, y: 7, w: 2, t: 'a', d: 1 }], left = [{ x: 2, y: 7, w: 2, t: 'a', d: -1 }];
    assert.deepStrictEqual(C.range(right, 0), [0, 2]);
    assert.deepStrictEqual(C.moves(right).map(m => m[1]), [1, 2]);
    assert.deepStrictEqual(C.moves(left).map(m => m[1]), [-1, -2]);
  },
  'arrow falls like a normal block'() {
    const bs = C.settle([{ x: 0, y: 2, w: 2, t: 'a', d: 1 }]);
    assert.strictEqual(bs[0].y, 7);
  },
  'spring neither falls nor moves'() {
    const bs = C.settle([B(3, 2, 1, 's')]);
    assert.strictEqual(bs[0].y, 2);
    assert.deepStrictEqual(C.moves(bs), []);
  },
  'block stopping against a spring bounces back to the far end'() {
    // floor row: [n n . . . s] -> slide n (x 0, w 2) right by 3 touches the spring, bounces back to x 0
    const bs = [B(1, 7, 2, 'n'), B(5, 7, 1, 's')];
    assert.deepStrictEqual(C.slide(bs, 0, 2), { x: 0, hit: 3 });
    assert.strictEqual(C.apply(bs, [0, 2])[0].x, 0);
    assert.deepStrictEqual(C.slide(bs, 0, 1), { x: 2 }, 'stopping short of the spring is a normal move');
    assert.deepStrictEqual(C.slide(bs, 0, -1), { x: 0 });
  },
  'bounce stops at the first obstacle'() {
    const bs = [B(0, 7, 1, 'f'), B(2, 7, 1, 'n'), B(4, 7, 1, 's')];
    assert.deepStrictEqual(C.slide(bs, 1, 1), { x: 1, hit: 3 });
  },
  'a bounced arrow goes against its direction; ice bounces too'() {
    const bs = [{ x: 1, y: 7, w: 1, t: 'a', d: 1 }, B(5, 7, 1, 's')];
    assert.strictEqual(C.apply(bs, [0, 3])[0].x, 0);
    const ice = [B(2, 7, 1, 'i'), B(0, 7, 1, 's')];
    assert.deepStrictEqual(C.moves(ice).map(m => m[1]).sort(), [-1, 3]);
    assert.strictEqual(C.apply(ice, [0, -1])[0].x, 5);
  },
  'block falls after bouncing back off its support'() {
    // block on a ledge slides into a spring, bounces past the ledge edge and falls
    const bs = [B(2, 5, 3, 'f'), B(3, 4, 1, 'n'), B(5, 4, 1, 's')];
    const n = C.apply(bs, [1, 1]);
    assert.strictEqual(n[1].x, 0);
    assert.strictEqual(n[1].y, 7);
  },
  'fromLevel keeps the arrow direction'() {
    assert.deepStrictEqual(C.fromLevel([[0, 1, 2, 'a', -1], [3, 4, 1, 'n']]), [{ x: 0, y: 1, w: 2, t: 'a', d: -1 }, { x: 3, y: 4, w: 1, t: 'n' }]);
  },
  'solvePath returns an optimal, valid solution'() {
    const LEVELS = require('../web/levels.js');
    for (const i of [0, 9, 16, 30]) {
      const L = LEVELS[i];
      let bs = C.fromLevel(L.blocks);
      const path = C.solvePath(bs, L.exit);
      assert.strictEqual(path.length, L.opt, `level ${i + 1}`);
      for (const m of path) { assert.ok(C.moves(bs).some(([b, d]) => b === m[0] && d === m[1])); bs = C.apply(bs, m); }
      assert.ok(C.won(bs, L.exit));
    }
  },
  'solvePath from a solved board is empty'() {
    assert.deepStrictEqual(C.solvePath([B(4, 7, 2, 'r')], 7), []);
  },
};

let fail = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
if (fail) { console.error(`${fail} test(ova) pada.`); process.exit(1); }
console.log('Svi testovi prolaze.');
