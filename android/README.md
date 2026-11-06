# Topple za Android

Aplikacija je nativna Kotlin ljuska (WebView) oko web igre iz `../web`, kao iOS aplikacija. Igra je spakirana u aplikaciju (assets), poslužuje se na `https://appassets.androidplatform.net/igra.html` i radi bez interneta. Računi, ljestvice i prijatelji idu na isti server kao web (`https://topple.rdd.software`). Server tu adresu uvijek pušta (CORS, `APP_ORIGINS` u `server.js`).

Nativno u aplikaciji:
- vibracija kod klizanja, slijetanja i pobjede (prati postavku dodira u sustavu);
- dijeljenje rezultata preko Androidova izbornika za dijeljenje;
- dnevni podsjetnik kao lokalna obavijest u 17:00, osim ako je dnevna zagonetka već riješena (WorkManager, bez servera; Android 13+ pita za dopuštenje kad ga igrač uključi);
- tipka Natrag zatvara otvoreni prozor igre (izbornik, ljestvicu…), inače šalje aplikaciju u pozadinu (`toppleBack` u `igra.html`);
- svijetla i tamna tema prema sustavu, napredak se prenosi na novi mobitel (Android sigurnosna kopija).

Igra zna da je u Android aplikaciji po `window.ToppleAndroid` (`ANDROID_APP` u `igra.html`) i šalje iste poruke `native({type})` kao iOS-u.

Prijava: korisničko ime ili e-mail i **Google** (nativni izbornik računa, Credential Manager, `GoogleSignIn.kt`). Aplikacija dobiva ID tokena za serverov web client ID (`/api/config`), pa ga server provjerava kao prijavu s weba (`/api/google`), bez promjena na serveru.

**Topple Plus**: jednokratna kupnja na Google Playu (Play Billing, `Store.kt`), ista kao na iOS-u: neograničeni savjeti, ponuda u izborniku i kad nestane savjeta. Aplikacija šalje igri `window.topplePlus({owned, price, play})`, a igra serveru token kupnje (`/api/plus {play: {token}}`); server ga provjerava s Google Play Developer API-jem (`server/play.js`) i daje oznaku PLUS, a povrat novca je briše.

**Google Play Games**: ista postignuća (15) i ljestvice (zvjezdice, beskonačne zagonetke) kao Game Center na iOS-u, iz iste poruke igre (`gc`, `GamesServices.kt`). Igrač se u Play Games prijavi automatski. ID-jevi su u `app/src/main/res/values/games-ids.xml`; dok su prazni, Play Games se ne pokreće.

**Prijava s Appleom**: Apple nema Android SDK, pa aplikacija otvori Appleovu stranicu za prijavu (Custom Tab, `AppleSignIn.kt`) za serverov **Services ID**. Apple pošalje rezultat serveru (`/api/apple/callback`), server ga provjeri i vrati preglednik u aplikaciju (`software.rdd.topple://apple`), a igra se prijavi tajnom koju zna samo aplikacija (`/api/apple {verifier}`). Gumb se pokaže tek kad je na serveru postavljen `APPLE_SERVICE_ID`. U aplikaciji nema web reklama, kao ni na iOS-u.

Svaka promjena web igre ulazi u sljedeći build: `web/` se kopira u aplikaciju pri svakom buildu (bez `admin/`).

## Google prijava: Android OAuth klijenti (jednom)

Google prepoznaje aplikaciju po nazivu paketa i SHA-1 otisku certifikata kojim je potpisana. U **istom** Google Cloud projektu u kojem je web client ID (`GOOGLE_CLIENT_ID` na serveru): APIs & Services → Credentials → **Create credentials → OAuth client ID → Android**, za svaki otisak po jedan klijent:

| Za | Package name | SHA-1 |
|---|---|---|
| debug APK (GitHub Actions i lokalno) | `software.rdd.topple` | `10:EC:D7:3C:0C:3B:47:D6:24:D1:A3:E4:54:F4:30:72:7E:AC:40:3D` |
| Google Play (testiranje i objava) | `software.rdd.topple` | Play Console → Test and release → Setup → **App signing** → *App signing key certificate* → SHA-1 |

Client ID Android klijenta ne upisuje se nikamo. Debug ključ je `app/debug.keystore` (u gitu, standardne lozinke `android`, nije tajna), pa svi debug buildovi imaju isti otisak. Ako Google prijava javi grešku, najčešće otisak ili naziv paketa nije upisan ili OAuth zaslon za pristanak nije objavljen (In production).

## Prijava s Appleom (jednom)

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers → +** → **Services IDs** → Description `Topple Sign in`, Identifier `software.rdd.topple.signin` → Register.
2. Otvori taj Services ID → uključi **Sign in with Apple** → Configure: Primary App ID `software.rdd.topple`, Domains `topple.rdd.software`, Return URLs `https://topple.rdd.software/api/apple/callback` → Save → Continue → Save.
3. Na serveru (PowerShell kao Administrator) ponovno pokreni instalacijsku skriptu sa Services ID-jem; ranije postavljeni Google ID-jevi ostaju:
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\topple\server\install.ps1 -AppleServiceId "software.rdd.topple.signin"
   ```
   Ključ za poništavanje prijave (`admin.js set-apple`) vrijedi i za ovo, jer je Services ID vezan uz isti App ID.

## Topple Plus na Google Playu (jednom)

1. **Payments profile** u Play Consoleu (Setup → Payments profile), kao Paid Apps Agreement kod Applea; treba za svaku naplatu.
2. Proizvod se može napraviti tek kad je u Play Consoleu barem jedan build s Play Billingom (bilo koji uploadani `.aab` iz ove verzije). Zatim: **Monetize with Play → Products → One-time products → Create**:
   - Product ID: `software.rdd.topple.plus` (isti kao na iOS-u, ne može se promijeniti)
   - Name: `Topple Plus`, Description: `Neograničeni savjeti u razinama i beskonačnim zagonetkama.` (prijevodi za en, it, de)
   - cijena (npr. ista kao na App Storeu; Google preračuna za ostale zemlje), pa **Activate**.
3. **Testiranje bez naplate**: Setup → **License testing** → dodaj svoj Google račun (i testere). Njima kupnja prikaže probnu karticu i ništa ne naplaćuje. Kupnja radi samo u aplikaciji instaliranoj s Google Playa (zatvoreno testiranje), ne u debug APK-u s GitHuba.
4. **Oznaka PLUS na serveru** (provjera kupnje):
   - Google Cloud Console (isti projekt kao Google prijava): APIs & Services → Library → **Google Play Android Developer API** → Enable.
   - IAM & Admin → Service Accounts → **Create service account** (npr. `topple-play`), bez uloga → Keys → Add key → JSON (preuzme se datoteka).
   - Play Console → **Users and permissions** → Invite new users → e-mail servisnog računa (`…@….iam.gserviceaccount.com`) → App permissions: Topple → **View financial data, orders and cancellation survey responses** → Invite.
   - Na serveru: `node server/admin.js set-play C:\putanja\topple-play-xxxx.json` (spremi u `play.json` uz bazu, nije u gitu). Dozvole u Play Consoleu ponekad počnu vrijediti tek nakon nekoliko sati.

## Google Play Games (jednom)

1. Play Console → aplikacija → **Grow users → Play Games Services → Setup and management → Configuration** → *No, my game doesn't use Google APIs* → naziv `Topple` → Create. Zapiši **Project ID** (broj od 12 znamenki, piše na toj stranici).
2. Isto mjesto → **Credentials → Add credential → Android**: odaberi Android OAuth klijent iz Google Clouda (onaj za Google Play, SHA-1 *App signing key*). Za probu s debug APK-om dodaj i drugi, s debug SHA-1. Ako ga nema na popisu, napravi ga ovdje.
3. Servisnom računu (onom za Topple Plus) u Play Consoleu → Users and permissions → Topple dodaj i dozvolu za **Play Games Services** (*Edit and delete draft apps* i *Manage Play Games Services*; ako skripta javi HTTP 403, privremeno mu daj Admin).
4. Postignuća i ljestvice unese skripta (tekstovi iz `ios/GameCenter.md`, ikone iz `store/achievements/`, 800 bodova od dopuštenih 1000):
   ```bash
   node android/tools/playgames-upload.js --dry-run
   node android/tools/playgames-upload.js --key ~/Downloads/topple-play-xxxx.json --app 123456789012
   ```
   Skripta upiše ID-jeve u `app/src/main/res/values/games-ids.xml`. Pošalji tu datoteku u repozitorij (ili je javi meni), pa je u sljedećem buildu.
   Ručno: Play Games Services → Achievements / Leaderboards → Add, pa **Get resources** (Android XML) i ID-jeve upiši u `games-ids.xml` pod imenima `achievement_<id>` (npr. `achievement_first`) i `leaderboard_stars`, `leaderboard_endless`.
5. Configuration → **Review and publish**. Dok nije objavljeno, Play Games radi samo za testere upisane pod *Testers* u Play Games Services.

## 1. Build bez instalacije ičega (GitHub Actions)

Svaki push na `main` koji mijenja `android/` ili `web/` pokrene workflow **Android app** (`.github/workflows/android.yml`). Može se pokrenuti i ručno: GitHub → Actions → Android app → Run workflow.

- **topple-debug-apk**: APK za instalaciju na mobitel. Preuzmi ZIP s dna stranice workflowa, otpakiraj i otvori `app-debug.apk` na Android mobitelu (dopusti instalaciju iz tog izvora).
- **topple-release-aab**: potpisani `.aab` za Google Play, samo kad su u repozitoriju postavljeni ključevi (korak 2).

`versionCode` je broj pokretanja workflowa + 100, pa svaki novi build ima veći broj, što Google Play traži.

## 2. Ključ za potpisivanje (jednom)

Google Play potpisuje aplikaciju svojim ključem (Play App Signing), a ti potpisuješ upload ključem. Ako se upload ključ izgubi, Google ga može zamijeniti, ali čuvaj ga (i lozinku) na sigurnom, izvan repozitorija.

Na Macu (treba Java: `brew install openjdk`, ili `keytool` iz Android Studija):

```bash
keytool -genkeypair -v -keystore ~/topple-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

Upiši lozinku (dvaput) i podatke (ime, grad, država HR). Zatim ga pretvori u tekst:

```bash
base64 -i ~/topple-upload.jks | pbcopy
```

GitHub → repozitorij → Settings → Secrets and variables → Actions → **New repository secret**, četiri tajne:

| Ime | Vrijednost |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | zalijepi (iz `pbcopy`) |
| `ANDROID_KEYSTORE_PASSWORD` | lozinka ključa |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | ista lozinka |

Zatim Actions → Android app → Run workflow (grana `main`) i preuzmi **topple-release-aab**.

Lokalno (Android Studio): napravi `android/keystore.properties` (nije u gitu) s `storeFile=/putanja/topple-upload.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…` i pokreni `./gradlew bundleRelease -PversionCode=N`.

## 3. Lokalno (po želji)

Android Studio → Open → mapa `android/`. Pokreni na mobitelu (USB, uključen način za razvojne programere) ili emulatoru. U debug buildu igru možeš pregledati u Chromeu na računalu: `chrome://inspect`.

## 4. Google Play Console

1. **Create app**: naziv `Topple: Gravity Puzzle`, zadani jezik hrvatski, Game, Free. Package name je `software.rdd.topple` (odredi ga prvi uploadani build).
2. **Testing → Closed testing**: napravi traku, dodaj testere (Google grupa ili popis e-mailova), upload `.aab`, pošalji izdanje na pregled. Testeri se prijave preko poveznice za opt-in. Za osobne račune treba **najmanje 12 testera 14 dana zaredom** prije zahtjeva za produkciju (Dashboard → Apply for production).
3. **App content** (lijevi izbornik, Policy):
   - Privacy policy: `https://topple.rdd.software/privatnost.html`
   - Ads: **No** (aplikacija nema reklama)
   - App access: dio mogućnosti traži prijavu. Upiši demo račun (isti kao za Apple, `AppReview`) i napomenu da se igra može igrati i kao gost.
   - Content rating (IARC upitnik): kategorija Puzzle/Game, bez nasilja, kockanja i sl.; korisnici ne razmjenjuju poruke (samo korisničko ime na ljestvici); ima kupnju u aplikaciji (Topple Plus, digitalna roba).
   - Target audience: **13+** (13–15, 16–17, 18+). Ako uključiš mlađe od 13, vrijede stroža pravila za obitelji (Families).
   - Data safety: prikuplja se **korisničko ime, e-mail (po želji, ili iz Google računa kod Google prijave)**, **ID korisnika i anonimni ID gosta**, **aktivnost u aplikaciji** (riješene razine, rezultati, potezi). Svrha: funkcionalnost aplikacije i račun. Ne dijeli se s trećima, šifrirano u prijenosu (HTTPS), korisnik može tražiti brisanje.
   - Account deletion URL: `https://topple.rdd.software/privatnost.html` (opisuje brisanje u profilu i e-mailom); račun se može izbrisati i u igri na webu.
   - Government apps, Financial features, Health: No.
4. **Store presence → Main store listing**: kratki opis (do 80 znakova), puni opis (do 4000), ikona `store/icon-512.png`, naslovna grafika `store/feature-graphic.png` (1024 × 500) i snimke zaslona `store/<jezik>/0N-phone.png` (1080 × 2160, ponovno: `node ios/tools/make-screenshots.js --android`). Tekstovi mogu biti isti kao za App Store (`ios/AppStore.md`), bez dijela o Game Centeru.
