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
| Teški | kad padne bar jedan red na krhki blok, razbije ga i pada dalje | gotovo |
| Krhki | ispucali blok, razbija ga teški blok u padu | gotovo |
| Balon | ne pada nego se diže dok ne udari u nešto iznad | gotovo |
| Rotacija | gumb koji okreće mrežu za 90° i mijenja smjer gravitacije | ideja |

## Razine

Razine se ne dizajniraju ručno. Generator slaže nasumične ploče, BFS solver za svaku izračuna minimalan broj poteza, a zadržavaju se ploče koje odgovaraju krivulji težine. Trenutno 60 razina u 6 poglavlja po 10. Kamen se uvodi na 3. razini, led na 6., teški i krhki na 11., baloni na 14., a od 17. su sve mehanike zajedno. Poglavlja 3–6 (razine 21–60) imaju ciljeve od 5 do 14 poteza i u svakom poglavlju izmjenjuju ploče s kamenom i ledom, teškim blokovima, balonima i svime zajedno. Najteže razine traže se i do dva sata po razini; kad se ne nađu, cilj se proširi ili ploča pojednostavi (vidi komentare u generatoru). Za razine s teškim blokom ili balonom generator provjerava da je mehanika stvarno potrebna: ako se ti blokovi zamijene običnima, optimalan broj poteza mora biti drukčiji.

## Načini igre

- **Razine:** 20 ručno odabranih razina s rastućom težinom.
- **Dnevna zagonetka:** ista za sve igrače taj dan (Europe/Zagreb). Mehanike se mijenjaju po danu u tjednu, a nedjeljom je teža. Ljestvica: najmanje poteza, pa najbrže vrijeme.
- **Beskonačno:** zajednički niz zagonetki koje postupno postaju teže i izmjenjuju mehanike. Ljestvica: najviše riješenih, pa zvjezdice.

Zagonetke su unaprijed generirane u `web/puzzles.js`, jer bi generiranje na mobitelu trajalo predugo. Iza kraja datoteke ista se ploča generira iz seeda.

## Računi i ljestvica

Jedan račun po uređaju: igrač na prvom pokretanju odabere nadimak, a uređaj dobije tajni ključ. Igra se može igrati i bez prijave. Rješenja se čuvaju lokalno i šalju serveru kad je dostupan. Server ponovno odigra poteze i sprema samo ispravna rješenja.

## Zvuk

Svi zvukovi su sintetizirani u pregledniku (Web Audio): udarci i struganje drveta za pomicanje i slijetanje, pucanje za krhki blok, marimba za pobjedu. Pozadinska glazba je Bachov Preludij u C-duru (BWV 846), djelo u javnom vlasništvu, u izvedbi mekog klavirskog zvuka.

## Monetizacija (za iOS verziju)

- Besplatno s prvim paketom razina.
- Jednokratna kupnja: sve razine + bez reklama.
- Opcionalno: reklama za savjet (pokaži sljedeći optimalni potez, solver to već zna).

## Plan prema iOS-u

1. Dovršiti mehanike i 100 razina u web prototipu (60 gotovo), testirati na mobitelu.
2. Prenijeti `core.js` u Swift paket (`ToppleCore`) s istim testovima kao `verify-levels.js`.
3. SpriteKit scena za ploču, SwiftUI za izbornike.
4. Haptika (UIImpactFeedbackGenerator), Game Center ljestvica za dnevnu zagonetku.
5. TestFlight, pa App Store.
