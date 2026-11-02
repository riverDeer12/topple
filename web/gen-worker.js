// Runs the puzzle generator (past the end of web/puzzles.js) and the hint solver off the main thread.
importScripts('core.js', 'gen.js');
onmessage = e => {
  const { kind, arg } = e.data;
  if (kind === 'hint') { postMessage({ hint: solvePath(arg.blocks, arg.exit) }); return; }
  const r = kind === 'daily' ? ToppleGen.dailyPuzzle(arg) : ToppleGen.endlessPuzzle(arg);
  postMessage(r.level);
};
