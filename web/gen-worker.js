// Runs the puzzle generator off the main thread (used past the end of web/puzzles.js).
importScripts('core.js', 'gen.js');
onmessage = e => {
  const { kind, arg } = e.data;
  const r = kind === 'daily' ? ToppleGen.dailyPuzzle(arg) : ToppleGen.endlessPuzzle(arg);
  postMessage(r.level);
};
