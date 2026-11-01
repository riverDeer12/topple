# Topple — upute za Claude Code

Klizna slagalica s gravitacijom. Trenutno je igrivi web prototip (`web/`), cilj je iOS igra (SwiftUI + SpriteKit).
Vlasnik projekta piše na hrvatskom; odgovaraj na hrvatskom, a kod, komentare i commit poruke piši na engleskom.
Tekst u igri (UI) je na hrvatskom.

## Struktura

- `web/index.html` — cijeli UI: CSS, render, povlačenje prstom, animacije, zvuk, zvjezdice, popis razina.
- `web/core.js` — čista logika igre (bez DOM-a): mreža, gravitacija (`settle`), dopušteni potezi, provjera pobjede, BFS solver. Koriste je i igra i alati.
- `web/levels.js` — podaci razina. Generira se, ne uređuj ručno bez `npm run verify`.
- `tools/generate-levels.js` — generator: nasumično slaže blokove i solverom bira ploče s traženim optimalnim brojem poteza.
- `tools/verify-levels.js` — ponovno rješava sve razine i provjerava da je `opt` točan minimum.
- `tools/test-core.js` — testovi pravila iz `core.js` (`npm test`).
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
- Nove vrste blokova: dodaj tip u `core.js` (`settle`, `moves`), stil u `index.html`, spec u generatoru.
- Generator troši nasumične brojeve za nove tipove samo kad ih spec traži, pa dodavanje novih specova ne mijenja postojeće razine.
- Razine 1–10 koriste stari LCG (zadržan da te razine ostanu iste). Od 11. razine svaka ima svoj seed (mulberry32), pa se mogu tražiti paralelno:
  `node tools/generate-levels.js --only 18` u više procesa, zatim `npm run generate`. Nađene razine se spremaju u `tools/.cache/` (nije u gitu).
- Teške razine (cilj 7+) traže se i do 45 minuta po razini.
- `index.html` mora raditi otvoren izravno iz datoteke i preko GitHub Pagesa, bez build koraka i bez npm ovisnosti u pregledniku.
- Testiranje u pregledniku: `npm run serve`, pa otvori http://localhost:8080.

## Sljedeći koraci (vidi docs/DESIGN.md)

1. Generator za beskonačan način igre i dnevnu zagonetku (isti seed za sve taj dan).
2. Više razina (cilj 40–60) i testiranje na mobitelu.
3. Prijenos na iOS: Swift paket s logikom iz `core.js`, SpriteKit scena, haptika, Game Center.
