# Topple: promocija

## App Preview (video za App Store)

`node ios/tools/make-preview.js` snimi video iz web igre za sva 4 jezika (`ios/previews/<jezik>.mp4`, 886 × 1920, 30 fps, oko 25 s, iPhone 6,9"): razina s lancem padova (teški blok, ispucali, balon), razina s oprugom, ljestvica, likovi i postignuća. Treba Playwright s Chromiumom i ffmpeg.

Upload: App Store Connect → aplikacija → verzija → za svaki jezik **App Previews and Screenshots** → iPhone 6.9" → povuci video na prvo mjesto (prije snimki zaslona). Poster frame se može odabrati nakon obrade. Video se može dodati samo dok je verzija u stanju za uređivanje (Prepare for Submission ili nova verzija).

## Gumb „Download on the App Store” i Smart App Banner

Apple ID aplikacije (`6830289324`) upisan je u `web/config.js` (`window.TOPPLE_IOS_APP_ID`).

Početna stranica tada pokaže Appleov službeni gumb na jeziku stranice, a Safari na iPhoneu pokaže traku za otvaranje ili preuzimanje aplikacije (Smart App Banner). U samoj aplikaciji se ne prikazuje ništa od toga.

## Gumb „Get it on Google Play”

Kad je Android aplikacija objavljena (produkcija na Google Playu), u `web/config.js` postavi `window.TOPPLE_PLAY_LIVE = true;`. Početna stranica tada pokaže Googleov službeni gumb na jeziku stranice, uz App Store gumb (ne u aplikacijama). Tekstovi za Google Play su u `android/PlayStore.md`.

## Objave za društvene mreže

Uz objavu priloži video (`ios/previews/<jezik>.mp4`) ili snimku zaslona (`ios/screenshots/<jezik>/01-iphone.png`). App Store: https://apps.apple.com/app/id6830289324; za Android (kad bude objavljen) dodaj https://play.google.com/store/apps/details?id=software.rdd.topple.

### Hrvatski

**Kratko (X, Threads):**
Topple je stigao na iPhone! Pomakni blok i sve iznad njega padne. 120 razina, nova dnevna zagonetka svaki dan i ljestvica s prijateljima. Besplatno, bez reklama.
https://apps.apple.com/app/id6830289324
#Topple #slagalica #mozgalica #iPhone

**Dulje (Instagram, Facebook):**
Topple, slagalica s gravitacijom, sada je i u App Storeu.

Pravila stanu u jednu rečenicu: pomakni blok lijevo ili desno, a sve što ostane bez oslonca padne. Izvedi crveni blok do izlaza u što manje poteza.

• 120 razina i 9 vrsta blokova: led, kamen, baloni, strelice, opruge…
• Dnevna zagonetka, ista za sve, s ljestvicom
• Beskonačni niz, 15 postignuća i 13 likova za otključati
• Game Center, igranje bez interneta, bez reklama

Preuzmi besplatno: poveznica u profilu
Igraj i u pregledniku: topple.rdd.software

#Topple #slagalica #zagonetka #mozgalica #logika #igre #iOS

### English

**Short (X, Threads):**
Topple is out on iPhone! Slide a block and everything above it falls. 120 levels, a new daily puzzle every day and leaderboards with friends. Free, no ads.
https://apps.apple.com/app/id6830289324
#Topple #puzzle #brainteaser #iPhone

**Long (Instagram, Facebook):**
Topple, the sliding puzzle with gravity, is now on the App Store.

The rules fit in one sentence: slide a block left or right, and whatever loses its support falls. Get the red block to the exit in as few moves as you can.

• 120 levels and 9 kinds of blocks: ice, stone, balloons, arrows, springs…
• A daily puzzle, the same for everyone, with a leaderboard
• An endless run, 15 achievements and 13 looks to unlock
• Game Center, plays offline, no ads

Download free: link in bio
Play in your browser too: topple.rdd.software

#Topple #puzzle #puzzlegame #brainteaser #logic #indiegame #iOS

### Italiano

**Breve (X, Threads):**
Topple è arrivato su iPhone! Sposta un blocco e tutto ciò che sta sopra cade. 120 livelli, un nuovo puzzle ogni giorno e classifiche con gli amici. Gratis, senza pubblicità.
https://apps.apple.com/app/id6830289324
#Topple #rompicapo #puzzle #iPhone

**Lungo (Instagram, Facebook):**
Topple, il puzzle a scorrimento con la gravità, ora è sull'App Store.

Le regole stanno in una frase: sposta un blocco a sinistra o a destra, e ciò che resta senza appoggio cade. Porta il blocco rosso all'uscita con meno mosse possibili.

• 120 livelli e 9 tipi di blocchi: ghiaccio, pietra, palloncini, frecce, molle…
• Un puzzle giornaliero, uguale per tutti, con classifica
• Una serie infinita, 15 obiettivi e 13 aspetti da sbloccare
• Game Center, si gioca offline, senza pubblicità

Scarica gratis: link nella bio
Gioca anche nel browser: topple.rdd.software

#Topple #rompicapo #puzzle #giochi #logica #indiegame #iOS

### Deutsch

**Kurz (X, Threads):**
Topple ist auf dem iPhone! Schieb einen Block und alles darüber fällt. 120 Level, jeden Tag ein neues Tagesrätsel und Bestenlisten mit Freunden. Kostenlos, ohne Werbung.
https://apps.apple.com/app/id6830289324
#Topple #Rätsel #Denkspiel #iPhone

**Lang (Instagram, Facebook):**
Topple, das Schiebe-Rätsel mit Schwerkraft, ist jetzt im App Store.

Die Regeln passen in einen Satz: Schieb einen Block nach links oder rechts, und was keinen Halt mehr hat, fällt. Bring den roten Block mit möglichst wenigen Zügen zum Ausgang.

• 120 Level und 9 Blockarten: Eis, Stein, Ballons, Pfeile, Federn…
• Ein Tagesrätsel, für alle gleich, mit Bestenliste
• Eine endlose Serie, 15 Erfolge und 13 Looks zum Freischalten
• Game Center, spielbar offline, ohne Werbung

Kostenlos laden: Link in der Bio
Auch im Browser spielbar: topple.rdd.software

#Topple #Rätsel #Puzzle #Denkspiel #Logik #Indiegame #iOS
