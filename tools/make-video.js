#!/usr/bin/env node
// Short promo videos for TikTok, Reels and Shorts (1080 × 1920, H.264, 30 fps, 13–21 s): a caption
// on the board, the level solved by the solver (each block glows before it moves), the win screen,
// then an end card with the address. No sound: add music in the social app.
// Needs Playwright with Chromium and ffmpeg. Output: dist/videos/topple-<lang>-<level>.mp4
//
//   node tools/make-video.js                       all presets (levels 11, 14, 101, 111) in hr and en
//   node tools/make-video.js 11 37 --lang hr,de    chosen levels and languages (hr, en, it, de)
//   node tools/make-video.js 37 --intro "Can you do it in {n}?" --done "{n} moves!"
//
// {n} in a caption is the level's target number of moves, {L} the number of levels.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(__dirname, '..', 'dist', 'videos');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const LEVELS = new Function(fs.readFileSync(path.join(WEB, 'levels.js'), 'utf8') + ';return LEVELS')();

const TEXT = {
  hr: { intro: 'Riješi u {n} poteza.', done: '{n} poteza. Savršeno!', end: ['Klizna slagalica s gravitacijom', '{L} razina · dnevna zagonetka · besplatno'] },
  en: { intro: 'Solve it in {n} moves.', done: '{n} moves. Perfect!', end: ['Gravity sliding puzzle', '{L} levels · daily puzzle · free'] },
  it: { intro: 'Risolvilo in {n} mosse.', done: '{n} mosse. Perfetto!', end: ['Puzzle scorrevole con gravità', '{L} livelli · rompicapo del giorno · gratis'] },
  de: { intro: 'Löse es in {n} Zügen.', done: '{n} Züge. Perfekt!', end: ['Schiebepuzzle mit Schwerkraft', '{L} Level · Tagesrätsel · gratis'] },
};
// Levels that show off a block type, with their own opening caption.
const PRESETS = {
  11: { hr: 'Samo {n} poteza. Vidiš li rješenje?', en: 'Only {n} moves. Can you see it?', it: 'Solo {n} mosse. Vedi la soluzione?', de: 'Nur {n} Züge. Siehst du die Lösung?' },
  14: { hr: 'Baloni padaju GORE. Riješi u {n}.', en: 'Balloons fall UP. Solve it in {n}.', it: 'I palloncini cadono IN SU. Risolvilo in {n}.', de: 'Ballons fallen nach OBEN. Löse es in {n}.' },
  101: { hr: 'Strelice kližu samo na jednu stranu. {n} poteza.', en: 'Arrows slide one way only. {n} moves.', it: 'Le frecce scorrono in un solo verso. {n} mosse.', de: 'Pfeile gleiten nur in eine Richtung. {n} Züge.' },
  111: { hr: 'Opruge odbijaju blokove. {n} poteza.', en: 'Springs bounce blocks back. {n} moves.', it: 'Le molle respingono i blocchi. {n} mosse.', de: 'Federn stoßen Blöcke zurück. {n} Züge.' },
};
const STYLE = `
  #cap{position:fixed;left:50%;transform:translateX(-50%);width:max-content;max-width:320px;top:100px;z-index:99;text-align:center;
    font:700 29px/1.15 Fredoka,sans-serif;color:#fff;background:#e4533a;padding:10px 18px 12px;border-radius:20px;
    box-shadow:0 6px 18px #0005;transition:opacity .35s;pointer-events:none}
  #end{position:fixed;inset:0;z-index:100;background:#1f3d38;color:#fff;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:14px;font-family:Fredoka,sans-serif;text-align:center;opacity:0;transition:opacity .5s;
    padding:0 24px;box-sizing:border-box;text-wrap:balance}
  #end b{font-size:76px;font-weight:700;letter-spacing:-1px}#end b span{color:#e4533a}
  #end .s{font-size:23px;font-weight:600;max-width:100%}#end .m{font-size:19px;opacity:.85}
  #end .u{margin-top:22px;font-size:25px;font-weight:600;background:#e4533a;padding:10px 22px;border-radius:999px}`;

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args.splice(i, 2)[1]; };
const langs = (opt('lang') || 'hr,en').split(',');
const customIntro = opt('intro'), customDone = opt('done');
const levels = args.length ? args.map(Number) : Object.keys(PRESETS).map(Number);

async function record(browser, level, lang) {
  const n = LEVELS[level - 1].opt, fill = s => s.replace(/\{n\}/g, n).replace(/\{L\}/g, LEVELS.length);
  const T = TEXT[lang];
  const intro = fill(customIntro || (PRESETS[level] || {})[lang] || T.intro), done = fill(customDone || T.done);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, colorScheme: 'light' });
  // The game from web/, offline (no API calls leave the browser).
  await ctx.route('https://topple.rdd.software/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    const f = path.join(WEB, u.pathname);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  await ctx.route(/googlesyndication|doubleclick|googletagservices/, r => r.abort());
  await ctx.addInitScript(([lang, level]) => {
    const set = (k, v) => localStorage.setItem('topple-' + k, JSON.stringify(v));
    localStorage.setItem('topple-lang', lang);
    const best = {}; for (let i = 0; i < level - 1; i++) best[i] = 3; // no "first level" achievement on the win screen
    set('best', best); set('seen', ['r', 'n', 'f', 'i', 'h', 'k', 'b', 'a', 's']); set('rules', true); set('asked', true);
    set('settings', { sfx: false, music: false, target: true });
  }, [lang, level]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error(`  ${lang} ${level}: ${e.message}`));
  await page.goto('https://topple.rdd.software/igra.html');
  await page.waitForTimeout(1500);
  await page.evaluate(i => openCampaign(i), level - 1);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: STYLE });
  await page.evaluate(([intro, end]) => {
    const cap = document.createElement('div'); cap.id = 'cap'; cap.textContent = intro; document.body.append(cap);
    const card = document.createElement('div'); card.id = 'end';
    card.innerHTML = '<b>Top<span>ple</span></b><div class="s"></div><div class="m"></div><div class="u">topple.rdd.software</div><div class="m">App Store · Web</div>';
    card.querySelector('.s').textContent = end[0]; card.querySelector('.m').textContent = end[1];
    document.body.append(card);
  }, [intro, T.end.map(fill)]);

  // Screencast: every painted frame with its timestamp.
  const cdp = await ctx.newCDPSession(page);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topple-video-')), frames = [];
  cdp.on('Page.screencastFrame', f => {
    const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920 });
  const t0 = Date.now() / 1000;
  await page.waitForTimeout(2300);
  await page.evaluate(async () => {
    const wait = ms => new Promise(ok => setTimeout(ok, ms));
    const moves = solvePath(blocks.map(b => ({ ...b })), ctx.level.exit);
    document.getElementById('cap').style.opacity = 0;
    for (const [k, d] of moves) {
      els[k].classList.add('hinted'); await wait(600); els[k].classList.remove('hinted');
      commit(k, d, Math.min(Math.abs(d), 3));
      await new Promise(ok => { const w = () => (busy ? setTimeout(w, 30) : ok()); w(); });
      await wait(550);
    }
  });
  await page.evaluate(text => { const cap = document.getElementById('cap'); cap.textContent = text; cap.style.top = '78px'; cap.style.opacity = 1; }, done);
  await page.waitForTimeout(2600);
  await page.evaluate(() => { document.getElementById('cap').style.opacity = 0; document.getElementById('end').style.opacity = 1; });
  await page.waitForTimeout(3200);
  await cdp.send('Page.stopScreencast');
  const t1 = Date.now() / 1000;
  await ctx.close();

  // Frames last until the next one; the last one until the end of the recording.
  let list = '';
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : f.t + Math.max(0.1, t1 - t0 - (f.t - frames[0].t) - 0.2);
    list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
  });
  list += `file '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const out = path.join(OUT, `topple-${lang}-${level}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true });
  console.log(`${path.relative(process.cwd(), out)}  (${n} poteza, „${intro}”)`);
}

(async () => {
  for (const l of langs) if (!TEXT[l]) throw new Error(`Nepoznat jezik: ${l} (hr, en, it, de).`);
  for (const l of levels) if (!LEVELS[l - 1]) throw new Error(`Nema razine ${l} (1–${LEVELS.length}).`);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const level of levels) for (const lang of langs) await record(browser, level, lang);
  await browser.close();
})().catch(e => { console.error('GREŠKA: ' + e.message); process.exit(1); });
