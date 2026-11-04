# Snimke zaslona za App Store

Ovdje spremi PNG snimke iz simulatora (⌘S), poredane po imenu: `01.png`, `02.png`… Najviše 10 po veličini.
- **iPhone 6,9″** (iPhone 16 Pro Max, 1320 × 2868) — obavezno
- **iPad 13″** (iPad Pro 13-inch, 2064 × 2752) — ako je aplikacija i za iPad

Snimke u ovoj mapi idu za sve jezike. Za snimke na pojedinom jeziku napravi podmapu `hr`, `en-US`, `it` ili `de-DE`. Jezik igre mijenjaš u izborniku.

```bash
node ios/tools/screenshots-upload.js --dry-run
node ios/tools/screenshots-upload.js --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX --issuer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Dodaj `--replace` da zamijeniš snimke koje su već u App Store Connectu.
