#!/usr/bin/env node
// Records the App Store app preview video (iPhone 6.9": 886 × 1920, H.264, 30 fps, about 25 s)
// from the web game, for hr, en-US, it and de-DE: a level with a chain of falls, a level with a
// spring, then leaderboard, looks and achievements. Uses Chromium's screencast and ffmpeg.
// Needs Playwright with Chromium and ffmpeg. Output: ios/previews/<locale>.mp4
//
//   node ios/tools/make-preview.js [hr|en-US|it|de-DE]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const WEB = path.join(__dirname, '..', '..', 'web');
const OUT = path.join(__dirname, '..', 'previews');
const LANGS = { hr: 'hr', 'en-US': 'en', it: 'it', 'de-DE': 'de' };
const W = 443, H = 960, SCALE = 2; // 886 × 1920
const NAMES = ['Luka', 'Matej', 'Ana', 'Iva', 'Petra', 'Ivan', 'Sara', 'Toni', 'Lea', 'Mia'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function apiAnswer(url) {
  const u = new URL(url);
  if (u.pathname === '/api/leaderboard') {
    const mode = u.searchParams.get('mode');
    const rows = NAMES.map((name, i) => mode === 'daily' ? { name, moves: 6 + Math.floor(i / 3), timeMs: 31000 + i * 9300, stars: 3, rank: i + 1, plus: i % 3 === 0 }
      : mode === 'endless' ? { name, solved: 58 - i * 4, stars: 160 - i * 11, rank: i + 1 } : { name, stars: 330 - i * 17, levels: 116 - i * 5, rank: i + 1 });
    rows[2].me = true;
    return { mode, date: u.searchParams.get('date'), rows, mine: rows[2] };
  }
  if (u.pathname === '/api/score') return { ok: true, mine: { rank: 3 } };
  return { ok: true };
}

async function record(browser, locale, lang) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: 'light' });
  await ctx.route('https://topple.rdd.software/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiAnswer(r.request().url())) });
    let f = path.join(WEB, u.pathname); if (f.endsWith('/')) f += 'index.html';
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error(`  ${locale}: ${e.message}`));
  await page.goto('https://topple.rdd.software/igra.html');
  await page.evaluate(lang => {
    const set = (k, v) => localStorage.setItem('topple-' + k, JSON.stringify(v));
    localStorage.setItem('topple-lang', lang);
    const best = {}; for (let i = 0; i < 95; i++) best[i] = 3;
    const daily = {}; for (let d = 1; d <= 6; d++) daily[new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)] = { moves: 7, timeMs: 52000 };
    set('best', best); set('progress', { daily, endless: { next: 24, stars: 61, best: {} } });
    set('asked', true); set('rules', true); set('seen', ['r', 'n', 'f', 'i', 'h', 'k', 'b', 'a', 's']);
    set('user', { name: 'Ana', token: 'sample-token-for-preview-0123456789' }); set('skin', 'classic');
    set('settings', { sfx: false, music: false });
  }, lang);
  await page.reload();
  await page.waitForTimeout(1500);

  // Screencast: every painted frame with its timestamp.
  const cdp = await ctx.newCDPSession(page);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const play = (level, pause) => page.evaluate(async ([level, pause]) => {
    openCampaign(level); showOnly(null);
    await new Promise(ok => setTimeout(ok, 900));
    const path = solvePath(blocks.map(b => ({ ...b })), ctx.level.exit);
    for (const [k, d] of path) {
      commit(k, d, Math.min(Math.abs(d), 3));
      await new Promise(ok => { const w = () => (busy ? setTimeout(w, 30) : ok()); w(); });
      await new Promise(ok => setTimeout(ok, pause));
    }
  }, [level, pause]);

  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
  await play(26, 380);                  // level 27: heavy block breaks cracked ones, a balloon rises
  await page.waitForTimeout(2200);       // win: stars
  await play(110, 420);                  // level 111: a spring bounces a block back
  await page.waitForTimeout(2000);
  await page.evaluate(() => openBoard('daily')); await page.waitForTimeout(2000);
  await page.evaluate(() => { setSkin('dragon'); openSkins(); }); await page.waitForTimeout(2000);
  await page.evaluate(() => openAch()); await page.waitForTimeout(1800);
  await cdp.send('Page.stopScreencast');
  await ctx.close();

  // Frames → constant 30 fps H.264 with a silent stereo track (App Store app preview format).
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1] ? frames[i + 1].t : f.t + 0.5) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${locale}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-vf', `scale=${W * SCALE}:${H * SCALE}:force_original_aspect_ratio=decrease,pad=${W * SCALE}:${H * SCALE}:(ow-iw)/2:(oh-ih)/2:color=0xE4EAE6,fps=30,format=yuv420p`,
    '-t', '29', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString());
  console.log(`${locale}: ${out} (${secs.toFixed(1)} s, ${frames.length} slika)`);
}

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch();
  for (const [locale, lang] of Object.entries(LANGS)) if (!only || only === locale) await record(browser, locale, lang);
  await browser.close();
})();
