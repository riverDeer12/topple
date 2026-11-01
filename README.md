# Topple

Klizna slagalica s gravitacijom. Pomakni blok, sve iznad njega padne. Dovedi crveni blok do izlaza u što manje poteza.

Ovo je igrivi web prototip. Cilj je iOS igra.

## Igraj

- Lokalno: otvori `web/index.html` u pregledniku, ili `npm run serve` pa http://localhost:8080
- Na mobitelu: uključi GitHub Pages (Settings → Pages → Source: GitHub Actions), igra se objavljuje iz mape `web/` pri svakom pushu na `main`.

## Razine

```
npm run verify     # provjeri da je svaka razina rješiva i da je cilj točan minimum
npm run generate   # generiraj novi set razina (pa ga provjeri)
```

Dizajn i plan: [docs/DESIGN.md](docs/DESIGN.md). Upute za Claude Code: [CLAUDE.md](CLAUDE.md).
