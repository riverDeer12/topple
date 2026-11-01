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
};

let fail = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
if (fail) { console.error(`${fail} test(ova) pada.`); process.exit(1); }
console.log('Svi testovi prolaze.');
