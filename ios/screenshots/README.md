# Snimke zaslona za App Store

Snimke u podmapama napravila je skripta `ios/tools/make-screenshots.js`. Ona otvori igru u veličini iPhonea 16 Pro Max i iPada 13″, s probnim napretkom i ljestvicom, za sva četiri jezika. Za nove snimke ponovno pokreni `node ios/tools/make-screenshots.js` (treba Playwright: `npm i -D playwright && npx playwright install chromium`).

Ovdje spremi PNG snimke iz simulatora (⌘S), poredane po imenu: `01.png`, `02.png`… Najviše 10 po veličini.
- **iPhone 6,9″** (iPhone 16 Pro Max, 1320 × 2868) — obavezno
- **iPad 13″** (iPad Pro 13-inch, 2064 × 2752) — ako je aplikacija i za iPad

Snimke u ovoj mapi idu za sve jezike. Za snimke na pojedinom jeziku napravi podmapu `hr`, `en-US`, `it` ili `de-DE`. Jezik igre mijenjaš u izborniku.

```bash
node ios/tools/screenshots-upload.js --dry-run
node ios/tools/screenshots-upload.js --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX --issuer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Dodaj `--replace` da zamijeniš snimke koje su već u App Store Connectu.
