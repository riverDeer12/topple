# Game Center: postignuća

**Brže: skriptom.** `ios/tools/gamecenter-upload.js` unese sva postignuća iz ove datoteke, s tekstovima na 4 jezika i slikama, preko App Store Connect API-ja. Postignuća koja već postoje preskoči, a dopuni im jezike i slike koji nedostaju. Treba Node 18+ (`brew install node`) i API ključ: *App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +*, Access **App Manager**. Preuzmi `.p8` i zapiši **Key ID** i **Issuer ID** (piše iznad popisa ključeva).

```bash
node ios/tools/gamecenter-upload.js --dry-run
node ios/tools/gamecenter-upload.js --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX --issuer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Ručno:**

App Store Connect → aplikacija → **Services → Game Center → Achievements → +**. Za svako postignuće:
- **Reference Name**: naslov na hrvatskom (vidi ga samo ti);
- **Achievement ID**: točno kao ispod (mora odgovarati kodu u `ios/Topple/Native.swift`);
- **Points**: kao ispod (ukupno 800 od najviše 1000, najviše 100 po postignuću);
- **Hidden**: No; **Achievable More Than Once**: No.

Zatim **Localization → Add Language** za svaki jezik: **Title**, **Pre-earned Description**, **Earned Description** i **Image**: `ios/achievements/<id>.png` (1024 × 1024, npr. `first.png` za `topple.ach.first`; ista slika za sve jezike). Naslovi i opisi „prije” isti su kao u igri (`ach.*` u `web/i18n.js`).

| Achievement ID | Points | Reference Name |
|---|---|---|
| `topple.ach.first` | 10 | Prvi korak |
| `topple.ach.levels25` | 30 | Zagrijavanje |
| `topple.ach.levels60` | 60 | Na pola puta |
| `topple.ach.levelsAll` | 100 | Majstor Topplea |
| `topple.ach.perfect10` | 40 | Precizno |
| `topple.ach.perfect50` | 100 | Savršenstvo |
| `topple.ach.nohint20` | 60 | Bez pomoći |
| `topple.ach.daily1` | 10 | Dobro jutro |
| `topple.ach.daily10` | 50 | Svakodnevica |
| `topple.ach.streak3` | 20 | Iskra |
| `topple.ach.streak7` | 50 | Vatra |
| `topple.ach.streak30` | 100 | Neugasivo |
| `topple.ach.endless10` | 30 | Bez kraja |
| `topple.ach.endless50` | 90 | Maraton |
| `topple.ach.skins5` | 50 | Garderoba |

## Hrvatski (Croatian)

| Achievement ID | Title | Pre-earned Description | Earned Description |
|---|---|---|---|
| `topple.ach.first` | Prvi korak | Riješi prvu razinu. | Prva razina je riješena. |
| `topple.ach.levels25` | Zagrijavanje | Riješi 25 razina. | Riješeno 25 razina. |
| `topple.ach.levels60` | Na pola puta | Riješi 60 razina. | Riješeno 60 razina. |
| `topple.ach.levelsAll` | Majstor Topplea | Riješi sve razine. | Sve razine su riješene. |
| `topple.ach.perfect10` | Precizno | Riješi 10 razina s 3 zvjezdice. | Deset razina s 3 zvjezdice. |
| `topple.ach.perfect50` | Savršenstvo | Riješi 50 razina s 3 zvjezdice. | Pedeset razina s 3 zvjezdice. |
| `topple.ach.nohint20` | Bez pomoći | Riješi 20 razina bez savjeta. | Dvadeset razina riješeno bez savjeta. |
| `topple.ach.daily1` | Dobro jutro | Riješi dnevnu zagonetku. | Prva dnevna zagonetka je riješena. |
| `topple.ach.daily10` | Svakodnevica | Riješi 10 dnevnih zagonetki. | Riješeno 10 dnevnih zagonetki. |
| `topple.ach.streak3` | Iskra | Riješi dnevnu zagonetku 3 dana zaredom. | Dnevna zagonetka 3 dana zaredom. |
| `topple.ach.streak7` | Vatra | Riješi dnevnu zagonetku 7 dana zaredom. | Dnevna zagonetka 7 dana zaredom. |
| `topple.ach.streak30` | Neugasivo | Riješi dnevnu zagonetku 30 dana zaredom. | Dnevna zagonetka 30 dana zaredom. |
| `topple.ach.endless10` | Bez kraja | Riješi 10 beskonačnih zagonetki. | Riješeno 10 beskonačnih zagonetki. |
| `topple.ach.endless50` | Maraton | Riješi 50 beskonačnih zagonetki. | Riješeno 50 beskonačnih zagonetki. |
| `topple.ach.skins5` | Garderoba | Otključaj 5 izgleda crvenog bloka. | Otključano 5 izgleda crvenog bloka. |

## English (U.S.)

| Achievement ID | Title | Pre-earned Description | Earned Description |
|---|---|---|---|
| `topple.ach.first` | First step | Solve the first level. | Solved the first level. |
| `topple.ach.levels25` | Warming up | Solve 25 levels. | Solved 25 levels. |
| `topple.ach.levels60` | Halfway there | Solve 60 levels. | Solved 60 levels. |
| `topple.ach.levelsAll` | Topple master | Solve every level. | Solved every level. |
| `topple.ach.perfect10` | Precise | Get 3 stars on 10 levels. | 3 stars on 10 levels. |
| `topple.ach.perfect50` | Perfectionist | Get 3 stars on 50 levels. | 3 stars on 50 levels. |
| `topple.ach.nohint20` | No help needed | Solve 20 levels without a hint. | Solved 20 levels without a hint. |
| `topple.ach.daily1` | Good morning | Solve a daily puzzle. | Solved a daily puzzle. |
| `topple.ach.daily10` | Daily habit | Solve 10 daily puzzles. | Solved 10 daily puzzles. |
| `topple.ach.streak3` | Spark | Solve the daily puzzle 3 days in a row. | Daily puzzle 3 days in a row. |
| `topple.ach.streak7` | On fire | Solve the daily puzzle 7 days in a row. | Daily puzzle 7 days in a row. |
| `topple.ach.streak30` | Unstoppable | Solve the daily puzzle 30 days in a row. | Daily puzzle 30 days in a row. |
| `topple.ach.endless10` | Endless | Solve 10 endless puzzles. | Solved 10 endless puzzles. |
| `topple.ach.endless50` | Marathon | Solve 50 endless puzzles. | Solved 50 endless puzzles. |
| `topple.ach.skins5` | Wardrobe | Unlock 5 looks for the red block. | Unlocked 5 looks for the red block. |

## Italiano (Italian)

| Achievement ID | Title | Pre-earned Description | Earned Description |
|---|---|---|---|
| `topple.ach.first` | Primo passo | Risolvi il primo livello. | Primo livello risolto. |
| `topple.ach.levels25` | Riscaldamento | Risolvi 25 livelli. | 25 livelli risolti. |
| `topple.ach.levels60` | A metà strada | Risolvi 60 livelli. | 60 livelli risolti. |
| `topple.ach.levelsAll` | Maestro di Topple | Risolvi tutti i livelli. | Tutti i livelli risolti. |
| `topple.ach.perfect10` | Preciso | Ottieni 3 stelle in 10 livelli. | 3 stelle in 10 livelli. |
| `topple.ach.perfect50` | Perfezionista | Ottieni 3 stelle in 50 livelli. | 3 stelle in 50 livelli. |
| `topple.ach.nohint20` | Senza aiuto | Risolvi 20 livelli senza suggerimenti. | 20 livelli risolti senza suggerimenti. |
| `topple.ach.daily1` | Buongiorno | Risolvi un rompicapo del giorno. | Rompicapo del giorno risolto. |
| `topple.ach.daily10` | Abitudine quotidiana | Risolvi 10 rompicapi del giorno. | 10 rompicapi del giorno risolti. |
| `topple.ach.streak3` | Scintilla | Risolvi il rompicapo del giorno 3 giorni di fila. | Rompicapo del giorno 3 giorni di fila. |
| `topple.ach.streak7` | In fiamme | Risolvi il rompicapo del giorno 7 giorni di fila. | Rompicapo del giorno 7 giorni di fila. |
| `topple.ach.streak30` | Inarrestabile | Risolvi il rompicapo del giorno 30 giorni di fila. | Rompicapo del giorno 30 giorni di fila. |
| `topple.ach.endless10` | Senza fine | Risolvi 10 rompicapi infiniti. | 10 rompicapi infiniti risolti. |
| `topple.ach.endless50` | Maratona | Risolvi 50 rompicapi infiniti. | 50 rompicapi infiniti risolti. |
| `topple.ach.skins5` | Guardaroba | Sblocca 5 aspetti del blocco rosso. | 5 aspetti del blocco rosso sbloccati. |

## Deutsch (German)

| Achievement ID | Title | Pre-earned Description | Earned Description |
|---|---|---|---|
| `topple.ach.first` | Erster Schritt | Löse das erste Level. | Erstes Level gelöst. |
| `topple.ach.levels25` | Aufgewärmt | Löse 25 Level. | 25 Level gelöst. |
| `topple.ach.levels60` | Halbzeit | Löse 60 Level. | 60 Level gelöst. |
| `topple.ach.levelsAll` | Topple-Meister | Löse alle Level. | Alle Level gelöst. |
| `topple.ach.perfect10` | Präzise | Hol 3 Sterne in 10 Leveln. | 3 Sterne in 10 Leveln. |
| `topple.ach.perfect50` | Perfektionist | Hol 3 Sterne in 50 Leveln. | 3 Sterne in 50 Leveln. |
| `topple.ach.nohint20` | Ganz ohne Hilfe | Löse 20 Level ohne Tipp. | 20 Level ohne Tipp gelöst. |
| `topple.ach.daily1` | Guten Morgen | Löse ein Tagesrätsel. | Ein Tagesrätsel gelöst. |
| `topple.ach.daily10` | Tägliche Gewohnheit | Löse 10 Tagesrätsel. | 10 Tagesrätsel gelöst. |
| `topple.ach.streak3` | Funke | Löse das Tagesrätsel 3 Tage in Folge. | Tagesrätsel 3 Tage in Folge. |
| `topple.ach.streak7` | Feuer und Flamme | Löse das Tagesrätsel 7 Tage in Folge. | Tagesrätsel 7 Tage in Folge. |
| `topple.ach.streak30` | Unaufhaltsam | Löse das Tagesrätsel 30 Tage in Folge. | Tagesrätsel 30 Tage in Folge. |
| `topple.ach.endless10` | Endlos | Löse 10 endlose Rätsel. | 10 endlose Rätsel gelöst. |
| `topple.ach.endless50` | Marathon | Löse 50 endlose Rätsel. | 50 endlose Rätsel gelöst. |
| `topple.ach.skins5` | Kleiderschrank | Schalte 5 Looks für den roten Block frei. | 5 Looks für den roten Block freigeschaltet. |

Ukupno bodova: 800.
