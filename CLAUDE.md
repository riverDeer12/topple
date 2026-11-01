# Topple — upute za Claude Code

Klizna slagalica s gravitacijom. Trenutno je igrivi web prototip (`web/`), cilj je iOS igra (SwiftUI + SpriteKit).
Vlasnik projekta piše na hrvatskom; odgovaraj na hrvatskom, a kod, komentare i commit poruke piši na engleskom.
Tekst u igri (UI) je na hrvatskom.

## Struktura

- `web/index.html` — cijeli UI: CSS, render, povlačenje prstom, animacije, izbornik, prijava, ljestvica, načini igre (razine, dnevna, beskonačno).
- `web/audio.js` — sintetizirani zvukovi drveta i glazba (Bach, Preludij u C-duru BWV 846), bez audio datoteka.
- `web/gen.js` — deterministički generator zagonetki (mulberry32 + seed). Koriste ga igra, worker (`gen-worker.js`), server i alati.
- `web/puzzles.js` — unaprijed generirane zagonetke: 300 beskonačnih i dnevne za godinu dana (`npm run puzzles`). Iza kraja datoteke igra i server generiraju iste ploče iz `gen.js`.
- `web/config.js` — adresa API servera (`TOPPLE_API`); prazno = igra bez servera.
- `web/core.js` — čista logika igre (bez DOM-a): mreža, gravitacija (`settle`), dopušteni potezi, provjera pobjede, BFS solver. Koriste je i igra i alati.
- `web/levels.js` — podaci razina. Generira se, ne uređuj ručno bez `npm run verify`.
- `tools/generate-levels.js` — generator: nasumično slaže blokove i solverom bira ploče s traženim optimalnim brojem poteza.
- `tools/verify-levels.js` — ponovno rješava sve razine i provjerava da je `opt` točan minimum.
- `tools/test-core.js` — testovi pravila iz `core.js` (`npm test`).
- `tools/generate-puzzles.js` — generira `web/puzzles.js` na svim jezgrama, s cacheom.
- `server/server.js` — API (Node 22.5+, `node:http` + `node:sqlite`, bez npm paketa): računi po uređaju, provjereni rezultati, ljestvice. Upute u `server/README.md`, testovi `npm run test:server`.
- `docs/DESIGN.md` — dizajn igre i plan.

## Pravila igre (izvor istine je `web/core.js`)

- Mreža 6 × 8, red 0 je na vrhu. Blokovi su visoki 1 polje, široki 1–3.
- Potez: jedan blok klizne lijevo ili desno za bilo koji broj slobodnih polja (kao Rush Hour).
- Nakon poteza sve pokretne blokove vuče gravitacija dolje dok ne stanu na nešto. Blok stoji ako je ispod bar jedne njegove ćelije nešto.
- Tipovi: `r` crveni (cilj), `n` obični, `i` led (klizi do kraja, nema djelomičnog pomaka), `f` kamen (ne miče se, ne pada),
  `h` teški (kad padne bar jedan red na `k`, razbije ga i pada dalje), `k` krhki/ispucali, `b` balon (diže se umjesto da pada).
- Redoslijed gravitacije: u svakom krugu sve što pada spusti se za red (odozdo), zatim se baloni dignu za red (odozgo), dok se ništa ne miče.
- Razbijeni blok ostaje u nizu s oznakom `g: true` da indeksi ostanu stabilni (UI, Vrati, solver).
- Pobjeda: crveni je u redu `exit` i dodiruje desni rub.
- Zvjezdice: 3 za `opt` poteza, 2 za `opt + 2`, inače 1.

## Konvencije

- Svaka promjena pravila ide u `core.js`, dobiva test u `tools/test-core.js` i mora proći `npm test` i `npm run verify`. Ako promjena pravila mijenja rješenja, ponovno generiraj razine (`npm run generate`).
- Nove vrste blokova: dodaj tip u `core.js` (`settle`, `moves`), stil u `index.html`, spec u generatoru, te naziv i kratak opis u `TYPES` u `index.html`. Opis se igraču prikaže kad prvi put naiđe na taj blok, a stoji i na stranici „Kako se igra” (gumb „?”).
- Generator troši nasumične brojeve za nove tipove samo kad ih spec traži, pa dodavanje novih specova ne mijenja postojeće razine.
- Razine 1–10 koriste stari LCG (zadržan da te razine ostanu iste). Od 11. razine svaka ima svoj seed (mulberry32), pa se mogu tražiti paralelno:
  `node tools/generate-levels.js --only 18` u više procesa, zatim `npm run generate`. Nađene razine se spremaju u `tools/.cache/` (nije u gitu).
- Teške razine (cilj 7+) traže se i do 45 minuta po razini.
- Dnevna zagonetka i beskonačna zagonetka #n moraju biti iste za sve igrače i server: ne mijenjaj `gen.js` (redoslijed nasumičnih brojeva, specove, `GAME`) bez ponovnog generiranja `puzzles.js`, jer bi se igra i server razišli.
- Server mora ostati bez npm ovisnosti. Svaki rezultat se provjerava ponovnim igranjem poteza (`replay`).
- `index.html` mora raditi otvoren izravno iz datoteke i preko GitHub Pagesa, bez build koraka i bez npm ovisnosti u pregledniku.
- Testiranje u pregledniku: `npm run serve`, pa otvori http://localhost:8080.

## Sljedeći koraci (vidi docs/DESIGN.md)

1. Postaviti igru i API na vlastiti server (31.147.206.142) na `https://topple.rdd.software` prema `server/README.md`. Server je Windows s IIS-om: IIS poslužuje `web/` i prosljeđuje `/api/` (pravila u `web/web.config`, treba URL Rewrite + ARR), API radi kao servis preko NSSM-a, ažuriranje sa `server/deploy.ps1`. GitHub Pages ostaje rezervna kopija bez ljestvice.
2. Više razina (cilj 40–60) i testiranje na mobitelu.
3. Prijenos na iOS: Swift paket s logikom iz `core.js`, SpriteKit scena, haptika, Game Center.
