# Topple — upute za Claude Code

Klizna slagalica s gravitacijom. Trenutno je igrivi web prototip (`web/`), cilj je iOS igra (SwiftUI + SpriteKit).
Vlasnik projekta piše na hrvatskom; odgovaraj na hrvatskom, a kod, komentare i commit poruke piši na engleskom.
Igra i početna stranica su na četiri jezika (hrvatski zadani, engleski, talijanski, njemački); vidi `web/i18n.js`.

## Struktura

- `web/index.html` — početna stranica: ljestvice uživo, pravila, vrste blokova, načini igre i mogućnosti. Sav tekst čita iz `content.js`, brojke iz podataka igre.
- `web/igra.html` — igra: render, povlačenje prstom, animacije, izbornik, prijava, ljestvica, načini igre (razine, dnevna, beskonačno).
- `web/content.js` — jedini izvor teksta o igri (pravila, vrste blokova, načini igre, mogućnosti) za početnu stranicu i „Kako se igra” u igri, na svim jezicima.
- `web/i18n.js` — prijevodi sučelja (ključevi `t('...')`, `data-i18n` u HTML-u), nazivi poglavlja, smiješna imena gostiju i množina po jeziku.
- `web/theme.css` — zajedničke boje (svijetla i tamna tema) i stilovi blokova.
- `web/audio.js` — sintetizirani zvukovi drveta i glazba (Bach, Preludij u C-duru BWV 846), bez audio datoteka.
- `web/gen.js` — deterministički generator zagonetki (mulberry32 + seed). Koriste ga igra, worker (`gen-worker.js`), server i alati.
- `web/puzzles.js` — unaprijed generirane zagonetke: 300 beskonačnih i dnevne za godinu dana (`npm run puzzles`). Iza kraja datoteke igra i server generiraju iste ploče iz `gen.js`.
- `web/admin/index.html` — administracija za vlasnika (`/admin`): igrači, gosti, aktivnost, napredak po razinama.
- `web/sw.js` — service worker za igranje bez interneta: datoteke igre mrežom prvo, iz cachea kad nema veze; `/api/` i `/admin` se ne spremaju. Nova datoteka koju igra treba mora se dodati u `FILES`.
- `web/config.js` — adresa API servera (`TOPPLE_API`); prazno = igra bez servera.
- `web/core.js` — čista logika igre (bez DOM-a): mreža, gravitacija (`settle`), dopušteni potezi, provjera pobjede, BFS solver. Koriste je i igra i alati.
- `web/levels.js` — podaci razina. Generira se, ne uređuj ručno bez `npm run verify`.
- `tools/generate-levels.js` — generator: nasumično slaže blokove i solverom bira ploče s traženim optimalnim brojem poteza.
- `tools/verify-levels.js` — ponovno rješava sve razine i provjerava da je `opt` točan minimum.
- `tools/test-core.js` — testovi pravila iz `core.js` (`npm test`).
- `tools/test-content.js` — provjerava da je svaka vrsta bloka iz razina i zagonetki opisana u `content.js` i ima stil u `theme.css` (`npm test`).
- `tools/generate-puzzles.js` — generira `web/puzzles.js` na svim jezgrama, s cacheom.
- `server/server.js` — API (Node 22.5+, `node:http` + `node:sqlite`, bez npm paketa): računi po uređaju, provjereni rezultati, ljestvice. Upute u `server/README.md`, testovi `npm run test:server`.
- `docs/DESIGN.md` — dizajn igre i plan.

## Pravila igre (izvor istine je `web/core.js`)

- Mreža 6 × 8, red 0 je na vrhu. Blokovi su visoki 1 polje, široki 1–3.
- Potez: jedan blok klizne lijevo ili desno za bilo koji broj slobodnih polja (kao Rush Hour).
- Nakon poteza sve pokretne blokove vuče gravitacija dolje dok ne stanu na nešto. Blok stoji ako je ispod bar jedne njegove ćelije nešto.
- Tipovi: `r` crveni (cilj), `n` obični, `i` led (klizi do kraja, nema djelomičnog pomaka), `f` kamen (ne miče se, ne pada),
  `h` teški (kad padne bar jedan red na `k`, razbije ga i pada dalje), `k` krhki/ispucali, `b` balon (diže se umjesto da pada),
  `a` strelica (klizi samo u smjeru `d`: 1 desno, -1 lijevo; u podacima razine peti element `[x, y, w, 'a', d]`, učitava se s `fromLevel`),
  `s` opruga (široka 1, ne miče se i ne pada; blok koji se zaustavi uz nju odbije se i klizi do kraja na suprotnu stranu, jednom, i strelica; `slide` u `core.js`).
- Redoslijed gravitacije: u svakom krugu sve što pada spusti se za red (odozdo), zatim se baloni dignu za red (odozgo), dok se ništa ne miče.
- Razbijeni blok ostaje u nizu s oznakom `g: true` da indeksi ostanu stabilni (UI, Vrati, solver).
- Pobjeda: crveni je u redu `exit` i dodiruje desni rub.
- Zvjezdice: 3 za `opt` poteza, 2 za `opt + 2`, inače 1.

## Konvencije

- Vlasnik je trajno dopustio: kad je promjena gotova i testovi prolaze, otvori pull request prema `main` i spoji ga bez pitanja. Spajanje na `main` objavljuje igru (GitHub Pages i server topple.rdd.software unutar 2 minute).
- Svaka promjena pravila ide u `core.js`, dobiva test u `tools/test-core.js` i mora proći `npm test` i `npm run verify`. Ako promjena pravila mijenja rješenja, ponovno generiraj razine (`npm run generate`).
- Nove vrste blokova: dodaj tip u `core.js` (`settle`, `moves`), stil u `theme.css`, spec u generatoru, te naziv i kratak opis u `TYPES` u `content.js`. Opis se igraču prikaže kad prvi put naiđe na taj blok, a stoji i na početnoj stranici i na „Kako se igra” (gumb „?”).
- Svaki novi tekst u sučelju ide u `i18n.js` na sva četiri jezika (nikad izravno u HTML/JS); poruke servera imaju `code` i prevode se u igri (`srv.<code>`). `npm test` pada ako nekom jeziku nedostaje ključ ili opis.
- Font naslova je Fredoka (podržava č ć đ š ž ä ö ü ß à è ì ò ù); ne vraćaj Lilita One.
- Svaka nova mogućnost, način igre ili promjena pravila mora se upisati u `content.js` (`RULES`, `MODES`, `FEATURES`), jer iz njega se pune početna stranica i „Kako se igra”. Brojke (razine, poglavlja, zagonetke) ne upisuj ručno, nego ih računaj iz podataka (`stats`).
- Generator troši nasumične brojeve za nove tipove samo kad ih spec traži, pa dodavanje novih specova ne mijenja postojeće razine.
- Razine 1–10 koriste stari LCG (zadržan da te razine ostanu iste). Od 11. razine svaka ima svoj seed (mulberry32), pa se mogu tražiti paralelno:
  `node tools/generate-levels.js --only 18` u više procesa, zatim `npm run generate`. Nađene razine se spremaju u `tools/.cache/` (nije u gitu).
- Teške razine (cilj 7+) traže se i do 45 minuta po razini, najteže i nekoliko sati. Pretraga sprema napredak svakih 25 pokušaja (`.progress` u `tools/.cache/`), pa se nakon prekida nastavlja s istim rezultatom.
- Strelice i opruge su u beskonačnim zagonetkama od #31 i u dnevnima od 2026-11-04 (`NEW_BLOCKS_*` u `gen.js`); ranije zagonetke se ne smiju mijenjati jer su ih igrači već riješili. Nove mehanike dodaj isto tako, od nekog broja ili datuma nadalje.
- Dnevna zagonetka i beskonačna zagonetka #n moraju biti iste za sve igrače i server: ne mijenjaj `gen.js` (redoslijed nasumičnih brojeva, specove, `GAME`) bez ponovnog generiranja `puzzles.js`, jer bi se igra i server razišli.
- Stare adrese (GitHub Pages: `*.github.io`, `rdd.software/topple`) automatski preusmjeravaju na `https://topple.rdd.software` i u adresi (`#import=`) nose napredak iz localStoragea; nova adresa ga spoji (`mergeImport` u `igra.html`, uvijek bolji rezultat; početna stranica na staroj adresi šalje na `igra.html`), a `sync()` nakon prijave pošalje rješenja serveru.
- Računi: korisničko ime ili e-mail + lozinka (scrypt), Google (provjera ID tokena u `server.js`, `GOOGLE_CLIENT_ID`), sesija po uređaju (tablica `sessions`). Profil (izbornik → profil) pokazuje statistiku i mjesta na ljestvicama iz `/api/me` i omogućuje promjenu korisničkog imena, e-maila i lozinke (`/api/account`). Gosti igraju bez računa uz ograničenja `GUEST` iz `content.js` (smiješno ime, prvih 10 razina, 10 beskonačnih); na ljestvicu mogu samo prijavljeni (server prima rezultate samo uz token).
- Izgledi (likovi) crvenog bloka: `SKINS` u `content.js` (id + razina koja ga otključava), opis u `SKIN_TEXT` (svaki jezik), stil `.skin-<id>` u `theme.css`, naziv `skin.<id>` u `i18n.js`; `npm test` provjerava sve. Prikazani su i na početnoj stranici (odjeljak „Likovi”). Odabir se sprema lokalno i na račun (`/api/account {skin}`, server provjerava je li otključan).
- Savjeti (`useHint` u `igra.html`): sljedeći potez najkraćeg rješenja iz trenutnog stanja (`solvePath` u `core.js`, računa se u workeru, plan se priprema čim se razina učita). 3 na početku, +1 dnevno do 10, dodatni za reklamu s nagradom (Google H5 Games Ads, `TOPPLE_ADS` u `config.js`; bez AdSense ID-ja probni prozor). U dnevnoj zagonetki nema savjeta. Pravne stranice (4 jezika): `web/privatnost.html`, `web/uvjeti.html`, `web/kontakt.html` (kontakt info@rdd.software, podaci obrta kao na rdd.software) — ažuriraj ih ako se mijenja što se sprema, dijeli ili nudi.
- Sigurnosne kopije: `server/backup.js` (dnevno u 4:30, lokalno 7 dana) šalje kopiju i na Google Drive vlasnika (RDD/DB_Backups/Topple, zadnjih 30) preko `server/gdrive.js` (drive.file, bez npm-a); povezivanje jednom sa `server/gdrive-auth.js`, testovi `tools/test-gdrive.js`.
- Gosti: igra šalje anonimni ID (`gid` u localStorageu) i napredak na `/api/guest` (tablica `guests`, schema v3), pri prijavi se ID poveže s računom; pregled `admin.js stats`. Opisano u pravilima privatnosti.
- Administracija: `web/admin/index.html` (samo hrvatski, interni alat, `noindex`, nije povezana s javnih stranica) čita `/api/admin/stats` (`adminStats` u `server.js`). Prijava iz tablice `admins` (schema v4, uz `users.last_seen`), postavlja se samo na serveru: `admin.js set-admin <ime> '<lozinka>'`. Lozinke administratora nikad ne upisuj u repozitorij.
- Težina razina: igra šalje `/api/play` (`start` kad se u pokušaju pomakne prvi blok, `solve` na pobjedi; tablica `plays`, schema v6, po igraču i razini; za goste `g<id>`, pri prijavi prelazi na `u<id>`). /admin prikazuje uspjeh, vrijeme, pokušaje i savjete po razini, a gumb „Kopiraj podatke” daje JSON za analizu. Razine se ugađaju prema tim podacima (zamjena ili preslagivanje razina, savjeti u `HINT_KEYS`).
- Prijatelji: tablica `friends` (schema v7, jednosmjerno, po korisničkom imenu), `/api/friends` (popis, `{add}`, `{remove}`), ljestvica `?friends=1` rangira samo igrača i njegove prijatelje (`board(..., only)`).
- Podsjetnik za dnevnu: Web Push bez npm-a u `server/push.js` (RFC 8291 šifriranje, provjereno primjerom iz RFC-a; VAPID ključ u `vapid.json` uz bazu — ne brisati, inače prestaju sve pretplate). Tablica `push_subs` (schema v8), `/api/push/subscribe|unsubscribe|solved`, `sendReminders()` svakih 10 min šalje jednom dnevno od `REMIND_HOUR` (17 h) onima koji danas nisu riješili. Adrese samo poznatih push servisa (`validEndpoint`). Prikaz obavijesti u `sw.js`.
- Zaboravljena lozinka: `/api/forgot` šalje e-mail s poveznicom `igra.html#reset=<token>` (tablica `password_resets`, schema v5, 1 sat, jednokratno), `/api/reset` postavlja lozinku i odjavljuje sve uređaje. SMTP klijent bez npm-a u `server/mail.js`, postavke u `smtp.json` uz bazu (`admin.js set-smtp`, `test-mail`). Tekst e-maila je u `RESET_MAIL` u `server.js` (4 jezika).
- Server mora ostati bez npm ovisnosti. Svaki rezultat se provjerava ponovnim igranjem poteza (`replay`).
- `index.html` i `igra.html` moraju raditi otvoreni izravno iz datoteke i preko GitHub Pagesa, bez build koraka i bez npm ovisnosti u pregledniku.
- Testiranje u pregledniku: `npm run serve`, pa otvori http://localhost:8080.

## Sljedeći koraci (vidi docs/DESIGN.md)

1. Postaviti igru i API na vlastiti server (31.147.206.142) na `https://topple.rdd.software` prema `server/README.md`. Server je Windows s IIS-om: IIS poslužuje `web/` i prosljeđuje `/api/` (pravila u `web/web.config`, treba URL Rewrite + ARR), API radi kao servis preko NSSM-a. Postava jednom skriptom `server/install.ps1` (kod u `C:\inetpub\wwwroot\topple`, podaci u `C:\inetpub\topple-data`); zakazani zadatak svake 2 minute pokreće `server/update.ps1` i instalira svaku novu verziju s `main`. Skripte su UTF-8 s BOM-om i CRLF zbog Windows PowerShella 5.1. GitHub Pages ostaje rezervna kopija bez ljestvice.
2. Razine 61–120 (poglavlja 7–12; nazivi su u `CHAPTERS` u `i18n.js`; 11 = strelice, 12 = opruge). `--upto N` zapisuje samo razine 1–N u `levels.js`. Testiranje na mobitelu. Specove dodaj na kraj `SPECS`; za teške ciljeve koristi raspon (`max`) i manje blokova, inače pretraga traje satima.
3. Prijenos na iOS: Swift paket s logikom iz `core.js`, SpriteKit scena, haptika, Game Center.
