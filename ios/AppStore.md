# Topple: tekstovi za App Store

**Skriptom:** `ios/tools/appstore-upload.js` upiše sve iz ove datoteke u App Store Connect za sva 4 jezika: naziv, podnaslov, opis, ključne riječi, promotivni tekst i URL-ove. Koristi isti API ključ kao `gamecenter-upload.js`. Postojeće tekstove zamijeni, a jezike koji nedostaju doda. „Što je novo” preskače za prvu verziju (dodaj `--whats-new` od verzije 1.1).

```bash
node ios/tools/appstore-upload.js --dry-run
node ios/tools/appstore-upload.js --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX --issuer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Ručno:**

Kopiraj u App Store Connect → aplikacija → **App Store** → jezik (gore desno dodaj lokalizacije: Croatian, English (U.S.), Italian, German). Ograničenja: naziv i podnaslov do 30 znakova, promotivni tekst do 170, ključne riječi do 100 (odvojene zarezom, bez razmaka), opis do 4000.

Brojke (razine, poglavlja, blokovi, likovi) vrijede za verziju 1.0. Kad dodaš razine, promijeni ih i ovdje.

---

## Hrvatski (primarni jezik)

**Naziv:** Topple: Gravity Puzzle

**Podnaslov:** Slagalica s gravitacijom

**Promotivni tekst:**
Pomakni blok i sve iznad njega padne. Nova dnevna zagonetka svaki dan, 120 razina i niz koji ne smiješ prekinuti. Bez reklama, radi i bez interneta.

**Ključne riječi:**
slagalica,zagonetka,logika,blokovi,mozgalica,dnevna,razine,klizanje,puzzle,strategija,mozak

**Opis:**
Topple je klizna slagalica s gravitacijom. Pravila stanu u jednu rečenicu: pomakni blok lijevo ili desno, a sve što ostane bez oslonca padne. Ali svaki potez pokreće lanac koji treba predvidjeti.

Izvedi crveni blok do izlaza u što manje poteza i osvoji tri zvjezdice.

ŠTO TE ČEKA
• 120 ručno provjerenih razina u 12 poglavlja, od laganih prvih koraka do teškog finala
• 9 vrsta blokova: led koji klizi do kraja, kamen koji se ne miče, teški blok koji lomi ispucale, baloni koji se dižu, strelice koje idu samo u jednom smjeru i opruge koje odbijaju
• Dnevna zagonetka, ista za sve igrače, s ljestvicom najmanje poteza i najbržeg vremena
• Beskonačni niz zagonetki koje postaju sve teže
• Svaka razina ima točan najmanji broj poteza, provjeren računalom

NATJECANJE I NAPREDAK
• Ljestvice za dnevnu zagonetku, beskonačni niz i zvjezdice, i samo s prijateljima
• Niz dana 🔥 za dnevnu zagonetku i 15 postignuća
• Game Center ljestvice i postignuća
• 13 likova crvenog bloka za otključati, od mačka i robota do zmaja i dijamanta
• Podijeli rezultat s prijateljima jednim dodirom

KAD ZAPNEŠ
• Savjet pokaže sljedeći najbolji potez iz trenutnog položaja
• Nakon rješenja pogledaj najkraće rješenje korak po korak
• Neograničeno „Vrati” i „Ispočetka”, bez kazne

UGODNO IGRANJE
• Bez reklama
• Radi i bez interneta, rezultati se pošalju kad se veza vrati
• Podsjetnik za dnevnu zagonetku navečer, samo ako zagonetka još nije riješena
• Zvukovi drveta i Bachov Preludij u C-duru, uz vibraciju
• Račun korisničkim imenom, e-mailom, Appleom ili Googleom; napredak je isti na mobitelu i na webu (topple.rdd.software)
• Hrvatski, engleski, talijanski i njemački

Može se igrati i bez računa, kao gost.

**Što je novo (1.0):**
Prva verzija Toppla za iPhone i iPad: 120 razina, dnevna zagonetka, beskonačni niz, ljestvice s prijateljima, Game Center i podsjetnik.

---

## English (U.S.)

**Name:** Topple: Gravity Puzzle

**Subtitle:** Sliding puzzle with gravity

**Promotional text:**
Slide a block and everything above it falls. A new daily puzzle every day, 120 levels and a streak you won't want to break. No ads, works offline.

**Keywords:**
puzzle,logic,blocks,brain,daily,sliding,gravity,levels,strategy,riddle,mind,teaser,falling

**Description:**
Topple is a sliding puzzle with gravity. The rules fit in one sentence: slide a block left or right, and anything left without support falls. But every move sets off a chain you have to see coming.

Get the red block to the exit in as few moves as possible and earn three stars.

WHAT'S INSIDE
• 120 hand-checked levels in 12 chapters, from gentle first steps to a tough finale
• 9 kinds of blocks: ice that slides all the way, stone that never moves, heavy blocks that smash cracked ones, balloons that rise, arrows that go one way only and springs that bounce blocks back
• A daily puzzle, the same for every player, with a leaderboard for fewest moves and fastest time
• An endless run of puzzles that keep getting harder
• Every level has an exact minimum number of moves, checked by a solver

COMPETE AND PROGRESS
• Leaderboards for the daily puzzle, the endless run and level stars, also with just your friends
• A 🔥 daily streak and 15 achievements
• Game Center leaderboards and achievements
• 13 looks for the red block to unlock, from a cat and a robot to a dragon and a diamond
• Share your result with friends in one tap

WHEN YOU'RE STUCK
• A hint shows the next best move from where you are
• After solving, watch the shortest solution step by step
• Unlimited Undo and Restart, no penalty

EASY TO ENJOY
• No ads
• Works offline; results are sent when you're back online
• An evening reminder for the daily puzzle, only if it's still unsolved
• Wooden sounds and Bach's Prelude in C major, with haptics
• Sign in with a username, e-mail, Apple or Google; your progress is the same on your phone and on the web (topple.rdd.software)
• English, Croatian, Italian and German

You can also play as a guest, without an account.

**What's New (1.0):**
The first version of Topple for iPhone and iPad: 120 levels, the daily puzzle, the endless run, friends leaderboards, Game Center and reminders.

---

## Italiano

**Nome:** Topple: Gravity Puzzle

**Sottotitolo:** Puzzle scorrevole e gravità

**Testo promozionale:**
Sposta un blocco e tutto quello che c'è sopra cade. Un nuovo rompicapo ogni giorno, 120 livelli e una serie da non interrompere. Senza pubblicità, anche offline.

**Parole chiave:**
puzzle,rompicapo,logica,blocchi,cervello,giornaliero,livelli,gravità,strategia,enigmi,mente

**Descrizione:**
Topple è un puzzle scorrevole con la gravità. Le regole stanno in una frase: sposta un blocco a sinistra o a destra, e tutto ciò che resta senza appoggio cade. Ma ogni mossa scatena una catena da prevedere.

Porta il blocco rosso all'uscita con il minor numero di mosse e conquista tre stelle.

COSA TROVI
• 120 livelli verificati in 12 capitoli, dai primi passi facili a un finale impegnativo
• 9 tipi di blocchi: ghiaccio che scivola fino in fondo, pietra che non si muove, blocchi pesanti che rompono quelli crepati, palloncini che salgono, frecce che vanno in una sola direzione e molle che fanno rimbalzare
• Un rompicapo del giorno, uguale per tutti, con classifica per meno mosse e tempo più veloce
• Una serie infinita di rompicapi sempre più difficili
• Ogni livello ha un numero minimo di mosse esatto, verificato al computer

SFIDE E PROGRESSI
• Classifiche per il rompicapo del giorno, la serie infinita e le stelle, anche solo con gli amici
• Una serie di giorni 🔥 e 15 traguardi
• Classifiche e obiettivi di Game Center
• 13 aspetti del blocco rosso da sbloccare, dal gatto e dal robot fino al drago e al diamante
• Condividi il risultato con gli amici con un tocco

QUANDO TI BLOCCHI
• Un suggerimento mostra la prossima mossa migliore dalla posizione attuale
• Dopo la soluzione guarda la soluzione più breve passo dopo passo
• Annulla e Ricomincia senza limiti e senza penalità

GIOCO PIACEVOLE
• Senza pubblicità
• Funziona offline; i risultati vengono inviati quando torni online
• Un promemoria serale per il rompicapo del giorno, solo se non è ancora risolto
• Suoni di legno e il Preludio in do maggiore di Bach, con vibrazione
• Accesso con nome utente, e-mail, Apple o Google; i progressi sono gli stessi sul telefono e sul web (topple.rdd.software)
• Italiano, inglese, croato e tedesco

Si può giocare anche come ospite, senza account.

**Novità (1.0):**
La prima versione di Topple per iPhone e iPad: 120 livelli, il rompicapo del giorno, la serie infinita, classifiche con gli amici, Game Center e promemoria.

---

## Deutsch

**Name:** Topple: Gravity Puzzle

**Untertitel:** Schiebepuzzle mit Schwerkraft

**Werbetext:**
Schieb einen Block und alles darüber fällt. Jeden Tag ein neues Rätsel, 120 Level und eine Serie, die du nicht abreißen lassen willst. Ohne Werbung, auch offline.

**Schlüsselwörter:**
puzzle,rätsel,logik,blöcke,denkspiel,täglich,level,schwerkraft,strategie,knobelspiel,gehirn

**Beschreibung:**
Topple ist ein Schiebepuzzle mit Schwerkraft. Die Regeln passen in einen Satz: Schieb einen Block nach links oder rechts, und alles, was keinen Halt mehr hat, fällt. Aber jeder Zug löst eine Kette aus, die du vorhersehen musst.

Bring den roten Block mit möglichst wenigen Zügen zum Ausgang und hol dir drei Sterne.

DAS ERWARTET DICH
• 120 geprüfte Level in 12 Kapiteln, von leichten ersten Schritten bis zum harten Finale
• 9 Arten von Blöcken: Eis, das bis zum Ende rutscht, Stein, der sich nie bewegt, schwere Blöcke, die rissige zerbrechen, Ballons, die aufsteigen, Pfeile, die nur in eine Richtung gehen, und Federn, die Blöcke zurückprallen lassen
• Ein Tagesrätsel, für alle gleich, mit Rangliste für die wenigsten Züge und die schnellste Zeit
• Eine endlose Reihe von Rätseln, die immer schwerer werden
• Jedes Level hat eine exakte Mindestzahl an Zügen, vom Computer geprüft

WETTBEWERB UND FORTSCHRITT
• Ranglisten für das Tagesrätsel, die endlose Reihe und die Sterne, auch nur mit Freunden
• Eine 🔥-Serie für das Tagesrätsel und 15 Erfolge
• Game-Center-Ranglisten und -Erfolge
• 13 Looks für den roten Block zum Freischalten, von Katze und Roboter bis Drache und Diamant
• Teile dein Ergebnis mit einem Tipp

WENN DU FESTSTECKST
• Ein Tipp zeigt den nächsten besten Zug aus der aktuellen Lage
• Nach dem Lösen siehst du die kürzeste Lösung Schritt für Schritt
• Unbegrenztes Zurück und Neustart, ohne Strafe

ENTSPANNT SPIELEN
• Ohne Werbung
• Funktioniert offline; Ergebnisse werden gesendet, sobald du wieder online bist
• Eine Erinnerung am Abend an das Tagesrätsel, nur wenn es noch ungelöst ist
• Holzklänge und Bachs Präludium in C-Dur, mit Vibration
• Anmeldung mit Benutzername, E-Mail, Apple oder Google; der Fortschritt ist auf dem Handy und im Web gleich (topple.rdd.software)
• Deutsch, Englisch, Kroatisch und Italienisch

Du kannst auch als Gast ohne Konto spielen.

**Neuigkeiten (1.0):**
Die erste Version von Topple für iPhone und iPad: 120 Level, das Tagesrätsel, die endlose Reihe, Ranglisten mit Freunden, Game Center und Erinnerungen.
