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

Još nije na Androidu: prijava s Appleom, Topple Plus (Google Play Billing) i Google Play Games. U aplikaciji nema web reklama, kao ni na iOS-u.

Svaka promjena web igre ulazi u sljedeći build: `web/` se kopira u aplikaciju pri svakom buildu (bez `admin/`).

## Google prijava: Android OAuth klijenti (jednom)

Google prepoznaje aplikaciju po nazivu paketa i SHA-1 otisku certifikata kojim je potpisana. U **istom** Google Cloud projektu u kojem je web client ID (`GOOGLE_CLIENT_ID` na serveru): APIs & Services → Credentials → **Create credentials → OAuth client ID → Android**, za svaki otisak po jedan klijent:

| Za | Package name | SHA-1 |
|---|---|---|
| debug APK (GitHub Actions i lokalno) | `software.rdd.topple` | `10:EC:D7:3C:0C:3B:47:D6:24:D1:A3:E4:54:F4:30:72:7E:AC:40:3D` |
| Google Play (testiranje i objava) | `software.rdd.topple` | Play Console → Test and release → Setup → **App signing** → *App signing key certificate* → SHA-1 |

Client ID Android klijenta ne upisuje se nikamo. Debug ključ je `app/debug.keystore` (u gitu, standardne lozinke `android`, nije tajna), pa svi debug buildovi imaju isti otisak. Ako Google prijava javi grešku, najčešće otisak ili naziv paketa nije upisan ili OAuth zaslon za pristanak nije objavljen (In production).

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
   - Content rating (IARC upitnik): kategorija Puzzle/Game, bez nasilja, kockanja i sl.; korisnici ne razmjenjuju poruke (samo korisničko ime na ljestvici), nema kupnje u ovoj verziji.
   - Target audience: **13+** (13–15, 16–17, 18+). Ako uključiš mlađe od 13, vrijede stroža pravila za obitelji (Families).
   - Data safety: prikuplja se **korisničko ime, e-mail (po želji, ili iz Google računa kod Google prijave)**, **ID korisnika i anonimni ID gosta**, **aktivnost u aplikaciji** (riješene razine, rezultati, potezi). Svrha: funkcionalnost aplikacije i račun. Ne dijeli se s trećima, šifrirano u prijenosu (HTTPS), korisnik može tražiti brisanje.
   - Account deletion URL: `https://topple.rdd.software/privatnost.html` (opisuje brisanje u profilu i e-mailom); račun se može izbrisati i u igri na webu.
   - Government apps, Financial features, Health: No.
4. **Store presence → Main store listing**: kratki opis (do 80 znakova), puni opis (do 4000), ikona `store/icon-512.png`, naslovna grafika `store/feature-graphic.png` (1024 × 500) i snimke zaslona `store/<jezik>/0N-phone.png` (1080 × 2160, ponovno: `node ios/tools/make-screenshots.js --android`). Tekstovi mogu biti isti kao za App Store (`ios/AppStore.md`), bez dijelova o Game Centeru i Topple Plusu.
