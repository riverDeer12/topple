#!/usr/bin/env node
// Makes the App Store screenshots from the web game (the app shows the same page), at the exact
// sizes App Store Connect wants: iPhone 6.9" (1320 × 2868) and iPad 13" (2064 × 2752), for
// hr, en-US, it and de-DE. Sample progress and leaderboard data are filled in.
// Needs Playwright with Chromium (npx playwright install chromium). Output: ios/screenshots/<locale>/.
// With --android: Google Play phone screenshots (1080 × 2160) in android/store/<locale>/.
//
//   node ios/tools/make-screenshots.js [--no-ipad] [--android]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WEB = path.join(__dirname, '..', '..', 'web');
const ANDROID = process.argv.includes('--android');
const OUT = ANDROID ? path.join(__dirname, '..', '..', 'android', 'store') : path.join(__dirname, '..', 'screenshots');
const LANGS = { hr: 'hr', 'en-US': 'en', it: 'it', 'de-DE': 'de' };
const DEVICES = ANDROID ? [{ name: 'phone', width: 360, height: 720, scale: 3, touch: true }] : [ // 1080 × 2160
  { name: 'iphone', width: 440, height: 956, scale: 3 },      // 1320 × 2868
  { name: 'ipad', width: 1032, height: 1376, scale: 2, touch: true }, // 2064 × 2752
];
const NAMES = ['Luka', 'Ana', 'Marko', 'Iva', 'Petra', 'Ivan', 'Sara', 'Toni', 'Lea', 'Mia', 'Filip'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

// Sample server answers: a leaderboard with the player in it, nothing else needed.
function apiAnswer(url) {
  const u = new URL(url);
  if (u.pathname === '/api/leaderboard') {
    const mode = u.searchParams.get('mode');
    const rows = NAMES.slice(0, 10).map((name, i) => mode === 'daily' ? { name, moves: 6 + Math.floor(i / 3), timeMs: 31000 + i * 9300, stars: 3, rank: i + 1 }
      : mode === 'endless' ? { name, solved: 58 - i * 4, stars: 160 - i * 11, rank: i + 1 } : { name, stars: 330 - i * 17, levels: 116 - i * 5, rank: i + 1 });
    rows[2].name = 'Ana'; rows[2].me = true; rows[1].name = 'Matej';
    return { mode, date: u.searchParams.get('date'), rows, mine: rows[2] };
  }
  if (u.pathname === '/api/me') return { name: 'Ana', campaign: {}, endless: { next: 1, stars: 0 }, daily: {}, skin: 'classic', stats: {}, ranks: {} };
  if (u.pathname === '/api/score') return { ok: true, mine: { rank: 3 } };
  return { ok: true };
}

async function shoot(browser, locale, lang, dev) {
  const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.scale, hasTouch: !!dev.touch, colorScheme: 'light' });
  await ctx.route('https://topple.rdd.software/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiAnswer(r.request().url())) });
    let f = path.join(WEB, u.pathname); if (f.endsWith('/')) f += 'index.html';
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error(`  ${locale} ${dev.name}: ${e.message}`));
  await page.goto('https://topple.rdd.software/igra.html');
  // Sample progress: 95 levels (mostly 3 stars), a 6-day daily streak, endless #24, signed in.
  await page.evaluate(lang => {
    const set = (k, v) => localStorage.setItem('topple-' + k, JSON.stringify(v));
    localStorage.setItem('topple-lang', lang);
    const best = {}; for (let i = 0; i < 95; i++) best[i] = i % 7 === 3 ? 2 : 3;
    const daily = {}; for (let d = 1; d <= 6; d++) daily[new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)] = { moves: 7, timeMs: 52000 };
    set('best', best); set('progress', { daily, endless: { next: 24, stars: 61, best: {} } });
    set('asked', true); set('rules', true); set('seen', ['r', 'n', 'f', 'i', 'h', 'k', 'b', 'a', 's']);
    set('user', { name: 'Ana', token: 'sample-token-for-screenshots-0123456789' }); set('skin', 'classic');
    set('settings', { sfx: false, music: false });
  }, lang);
  await page.reload();
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  const dir = path.join(OUT, locale); fs.mkdirSync(dir, { recursive: true });
  const file = n => path.join(dir, `${String(n).padStart(2, '0')}-${dev.name}.png`);
  const snap = async n => { await page.waitForTimeout(500); await page.screenshot({ path: file(n) }); };
  const play = async (moves) => page.evaluate(async moves => {
    for (const [k, d] of moves) { commit(k, d, 1); await new Promise(ok => { const w = () => (busy ? setTimeout(w, 30) : ok()); w(); }); }
  }, moves);
  const solution = () => page.evaluate(() => solvePath(blocks.map(b => ({ ...b })), ctx.level.exit));

  // 1. A board with ice, heavy and cracked blocks, two moves in, a hint shown.
  await page.evaluate(() => { openCampaign(84); showOnly(null); });
  let sol = await solution();
  await play(sol.slice(0, 2));
  await page.evaluate(() => useHint()); await page.waitForTimeout(1500);
  await snap(1);
  // 2. Daily puzzle won: three stars, day 7 in a row, a new achievement.
  await page.evaluate(async () => { await openDaily(); }); await page.waitForTimeout(1500);
  await page.evaluate(() => showOnly(null));
  sol = await solution();
  await page.evaluate(() => { t0 = Date.now() - 48000; }); // a believable solving time
  await play(sol); await page.waitForTimeout(1500);
  await snap(2);
  // 3. Daily leaderboard.
  await page.evaluate(() => openBoard('daily')); await page.waitForTimeout(800);
  await snap(3);
  // 4. Springs and arrows.
  await page.evaluate(() => { openCampaign(116); showOnly(null); });
  sol = await solution();
  await play(sol.slice(0, 1));
  await snap(4);
  // 5. Looks of the red block.
  await page.evaluate(() => { setSkin('dragon'); openSkins(); });
  await snap(5);
  // 6. Achievements.
  await page.evaluate(() => openAch());
  await snap(6);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [locale, lang] of Object.entries(LANGS).filter(([l]) => !process.env.ONLY || l === process.env.ONLY)) {
    for (const dev of DEVICES) {
      if (dev.name === 'ipad' && process.argv.includes('--no-ipad')) continue;
      await shoot(browser, locale, lang, dev);
      console.log(`${locale} ${dev.name}: 6 snimki`);
    }
  }
  await browser.close();
})();
