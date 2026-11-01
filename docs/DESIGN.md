# Topple — dizajn igre

## Ideja

Klasična klizna slagalica, ali s gravitacijom: kad pomakneš blok, sve što je stajalo na njemu padne. Cilj je izgurati crveni blok kroz izlaz na desnom rubu u što manje poteza. Svaki potez ima lančanu reakciju koju moraš predvidjeti.

## Zašto je zarazna

- Kontrola jednim prstom: povuci lijevo ili desno.
- Kratke razine, trenutni restart i neograničen "Vrati", pa je eksperimentiranje bez kazne.
- Zvjezdice za optimalan broj poteza tjeraju na vraćanje starim razinama.
- Taktilan osjećaj: blokovi se "zgnječe" pri slijetanju, uz zvuk i haptiku.

## Vrste blokova

| Tip | Ponašanje | Status |
|---|---|---|
| Obični | klizi za bilo koji broj polja, pada | gotovo |
| Crveni | kao obični, mora doći do izlaza | gotovo |
| Kamen | ne miče se, ne pada, služi kao platforma | gotovo |
| Led | klizi do prve prepreke | gotovo |
| Teški | kad padne, razbije krhki blok ispod sebe | plan |
| Krhki | razbija ga teški blok | plan |
| Balon | ne pada nego se diže | plan |
| Rotacija | gumb koji okreće mrežu za 90° i mijenja smjer gravitacije | ideja |

## Razine

Razine se ne dizajniraju ručno. Generator slaže nasumične ploče, BFS solver za svaku izračuna minimalan broj poteza, a zadržavaju se ploče koje odgovaraju krivulji težine. Trenutno 10 razina, cilj od 2 do 9 poteza. Kamen se uvodi na 3. razini, led na 6.

## Monetizacija (za iOS verziju)

- Besplatno s prvim paketom razina.
- Jednokratna kupnja: sve razine + bez reklama.
- Opcionalno: reklama za savjet (pokaži sljedeći optimalni potez, solver to već zna).

## Plan prema iOS-u

1. Dovršiti mehanike i 40–60 razina u web prototipu, testirati na mobitelu preko GitHub Pagesa.
2. Prenijeti `core.js` u Swift paket (`ToppleCore`) s istim testovima kao `verify-levels.js`.
3. SpriteKit scena za ploču, SwiftUI za izbornike.
4. Haptika (UIImpactFeedbackGenerator), Game Center ljestvica za dnevnu zagonetku.
5. TestFlight, pa App Store.
