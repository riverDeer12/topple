# Topple za iOS

Aplikacija je nativna SwiftUI ljuska oko web igre iz `../web`. Igra je spakirana u aplikaciju i radi bez interneta. Računi, ljestvice i prijatelji idu na isti server kao web (`https://topple.rdd.software`).

Nativno u aplikaciji:
- vibracija (haptika) kod klizanja, slijetanja i pobjede;
- dijeljenje rezultata preko iOS izbornika za dijeljenje;
- dnevni podsjetnik kao lokalna obavijest u 17:00, osim ako je dnevna zagonetka već riješena (iOS ga zakazuje sam, bez servera);
- Game Center: ljestvice (zvjezdice u razinama, beskonačne zagonetke) i 15 postignuća;
- reklame s nagradom za dodatne savjete preko AdMoba (`Topple/Ads.swift`), kao na Androidu.

Prijava: korisničko ime ili e-mail, **Sign in with Apple** i **Google** (preko sigurnog sistemskog prozora, `SignIn.swift`). Apple traži Apple prijavu čim aplikacija nudi Google prijavu.

Razlike prema webu:
- reklame za savjete su AdMob (nativni SDK), a ne web reklame (H5 Games Ads u aplikaciji nisu dopuštene).

Svaka promjena web igre ulazi u sljedeći build aplikacije: datoteke iz `web/` kopiraju se u aplikaciju pri svakom buildu.

## 1. Prvo pokretanje (Mac)

```bash
brew install xcodegen
```

```bash
cd topple/ios && xcodegen
```

```bash
open Topple.xcodeproj
```

U Xcodeu:
1. Lijevo odaberi projekt **Topple**, target **Topple**, karticu **Signing & Capabilities**.
2. Pod **Team** odaberi svoj Apple Developer račun. Bundle ID je `software.rdd.topple`, a možeš ga promijeniti u `project.yml` pa ponovno pokreni `xcodegen`.
3. Ako Game Center nije na popisu, dodaj ga s **+ Capability → Game Center**.
4. Spoji iPhone kabelom, gore odaberi njega i klikni ▶︎. Kod prvog pokretanja na iPhoneu dopusti developera: *Postavke → Općenito → VPN i upravljanje uređajem*. Na iOS 16 i novijima treba uključiti i *Postavke → Privatnost i sigurnost → Developer Mode*.

Kad se `project.yml` promijeni (nove datoteke, verzija), ponovno pokreni `xcodegen`. Datoteka `Topple.xcodeproj` se generira i nije u gitu.

Za debug buildove web dio se može pregledavati u Safariju na Macu: *Develop → tvoj iPhone → Topple*.

## Prijava s Appleom i Googleom (jednom)

**Apple**
1. U Xcodeu, na kartici **Signing & Capabilities**, mora biti **Sign in with Apple** (dolazi iz `Topple.entitlements`). Ako ga nema, dodaj ga s **+ Capability**.
2. Server prihvaća Apple prijave za bundle ID `software.rdd.topple`. Za drugi bundle ID postavi `APPLE_BUNDLE_ID`.
3. **Poništavanje kod brisanja računa** (Apple to traži): na https://developer.apple.com/account → **Certificates, IDs & Profiles → Keys → +**:
   - naziv npr. „Topple Sign in with Apple”;
   - uključi **Sign in with Apple** → **Configure**, odaberi App ID `software.rdd.topple`;
   - **Continue → Register → Download**: preuzima se `AuthKey_XXXXXXXXXX.p8`, a preuzeti se može samo jednom.
   - Zapiši **Key ID** (10 znakova, piše uz ključ) i **Team ID** (gore desno na developer.apple.com, ili *Membership details*).

   Kopiraj `.p8` na server, npr. u `C:\inetpub\topple-data\`, i pokreni:

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js set-apple TEAMID KEYID C:\inetpub\topple-data\AuthKey_KEYID.p8 --db C:\inetpub\topple-data\topple.db
```

   Ključ se spremi u `apple.json` uz bazu. Od tada server pri svakoj Apple prijavi zamijeni jednokratni kod za token. Kad igrač izbriše račun, server tim tokenom poništi Apple prijavu (`server/apple.js`). Za račune koji su se Appleom prijavili prije postavljanja ključa token se spremi pri sljedećoj prijavi.

**Google**
1. U Google Cloud Consoleu, u istom projektu kao za web: **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **iOS**
   - Bundle ID: `software.rdd.topple`
   - **Create**, pa kopiraj **Client ID** (završava na `.apps.googleusercontent.com`).
2. Upiši ga u `ios/project.yml` (`GOOGLE_IOS_CLIENT_ID: "…"`), pa pokreni `xcodegen`.
3. Na serveru ponovno pokreni instalacijsku skriptu s oba ID-ja, web i iOS (PowerShell kao Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\topple\server\install.ps1 -GoogleClientId "WEB-ID.apps.googleusercontent.com" -GoogleIosClientId "IOS-ID.apps.googleusercontent.com"
```

Gumb „Nastavi s Googleom” u aplikaciji pojavi se kad server ima iOS ID. Računi su isti kao na webu: isti Google račun ili isti e-mail znači isti igrač.

## 2. App Store Connect

Na https://appstoreconnect.apple.com → **Apps → +** napravi novu aplikaciju:
- naziv **Topple**;
- primarni jezik hrvatski;
- bundle ID `software.rdd.topple`;
- SKU npr. `topple-ios`.

### Game Center
U aplikaciji: **Services → Game Center** (ili *Features → Game Center*).

**Leaderboards**, tip *Classic*, *High score*, *Best score*:

| Leaderboard ID | Naziv |
|---|---|
| `topple.stars` | Zvjezdice u razinama |
| `topple.endless` | Beskonačne zagonetke |

**Achievements** (ID, naziv, opis; bodovi po želji, npr. 10–50, ukupno najviše 1000):

| Achievement ID | Naziv | Opis |
|---|---|---|
| `topple.ach.first` | Prvi korak | Riješi prvu razinu. |
| `topple.ach.levels25` | Zagrijavanje | Riješi 25 razina. |
| `topple.ach.levels60` | Na pola puta | Riješi 60 razina. |
| `topple.ach.levelsAll` | Majstor Topplea | Riješi sve razine. |
| `topple.ach.perfect10` | Precizno | Riješi 10 razina s 3 zvjezdice. |
| `topple.ach.perfect50` | Savršenstvo | Riješi 50 razina s 3 zvjezdice. |
| `topple.ach.nohint20` | Bez pomoći | Riješi 20 razina bez savjeta. |
| `topple.ach.daily1` | Dobro jutro | Riješi dnevnu zagonetku. |
| `topple.ach.daily10` | Svakodnevica | Riješi 10 dnevnih zagonetki. |
| `topple.ach.streak3` | Iskra | Riješi dnevnu zagonetku 3 dana zaredom. |
| `topple.ach.streak7` | Vatra | Riješi dnevnu zagonetku 7 dana zaredom. |
| `topple.ach.streak30` | Neugasivo | Riješi dnevnu zagonetku 30 dana zaredom. |
| `topple.ach.endless10` | Bez kraja | Riješi 10 beskonačnih zagonetki. |
| `topple.ach.endless50` | Maraton | Riješi 50 beskonačnih zagonetki. |
| `topple.ach.skins5` | Garderoba | Otključaj 5 izgleda crvenog bloka. |

Svako postignuće treba sliku 512 × 512 ili 1024 × 1024. Može ista za sve: `Topple/Assets.xcassets/AppIcon.appiconset/icon-1024.png`. Za ostale jezike lokalizaciju dodaješ u istom obrascu.

### Podaci za App Store
- **Kategorija:** Games → Puzzle. **Dobna granica:** 4+.
- **Privacy Policy URL:** `https://topple.rdd.software/privatnost.html`
- **Support URL:** `https://topple.rdd.software/kontakt.html`
- **App Privacy** (podaci o privatnosti):
  - *Contact Info → Email Address* (neobavezno, za prijavu i novu lozinku): Linked to user, App Functionality.
  - *User Content → Other* (korisničko ime) i *Gameplay → rezultati*: Linked to user, App Functionality.
  - *Identifiers → User ID*: Linked to user, App Functionality.
  - *Usage Data → Product Interaction* (statistika igranja razina): Linked to user, Analytics.
  - Tracking: **No**.
- **Brisanje računa:** postoji u aplikaciji (*Profil → Izbriši račun*), kako Apple traži.
- **Snimke zaslona:** u simulatoru iPhone 16 Pro Max (6,9″) i, ako je aplikacija i za iPad, iPad Pro 13″ napravi ⌘S. Spremi ih u `ios/screenshots/` i uploadaj skriptom `ios/tools/screenshots-upload.js` (vidi `ios/screenshots/README.md`).

## Topple Plus (kupnja u aplikaciji)

Jednokratna kupnja (non-consumable) `software.rdd.topple.plus` daje neograničene savjete. Kod je u `Topple/Store.swift` (StoreKit 2), a ponuda se u igri pojavi u izborniku i kad ponestane savjeta.

**Jednom u App Store Connectu:**
1. **Business** (gore) → **Agreements**: potpiši **Paid Apps Agreement** i ispuni bankovni račun i porezni obrazac (za fizičku osobu W-8BEN). Bez toga kupnje ne rade, ni u TestFlightu.
2. Aplikacija → **Monetization → In-App Purchases → +** → **Non-Consumable**:
   - Reference Name `Topple Plus`, Product ID `software.rdd.topple.plus` (točno ovako)
   - **Price**: npr. 2,99 €. **Family Sharing**: uključeno.
   - **Localization** za hr, en-US, it, de-DE: Display Name `Topple Plus`; Description npr. „Neograničeni savjeti, jednokratna kupnja” / „Unlimited hints, one-time purchase” / „Suggerimenti illimitati, acquisto unico” / „Unbegrenzte Tipps, einmaliger Kauf”.
   - **Review Information**: snimka `ios/review/topple-plus.png`. Napomena: „Opens from the menu (Topple Plus) or when hints run out. Unlimited hints; restore with Restore purchase.”
3. Prvu kupnju Apple pregledava zajedno s verzijom aplikacije: na stranici verzije, u odjeljku **In-App Purchases and Subscriptions**, dodaj Topple Plus. Ako je verzija 1.0 već poslana, ide uz 1.1.
4. **Small Business Program** (Apple uzima 15 % umjesto 30 %): prijava na https://developer.apple.com/app-store/small-business-program/

**Isprobavanje:**
- **U Xcodeu (bez App Store Connecta):** projekt koristi `Topple.storekit`, pa kupnja u simulatoru ili na spojenom iPhoneu radi odmah, bez naplate. Ako se ne pojavi, provjeri *Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration: Topple.storekit*.
- **U TestFlightu:** kupnje su besplatne (sandbox), a proizvod mora postojati u App Store Connectu.

## AdMob (reklame za savjete)

Igra pošalje `native({type:'ad', action})`, a `Topple/Ads.swift` odgovara s `window.toppleAds({ready, loading, privacy, result})`, isto kao Android. Redoslijed pri prvoj reklami: Googleov obrazac za privolu (UMP, samo u EU/EGP i UK), zatim Appleovo pitanje o praćenju (ATT), zatim učitavanje reklame. Glazba se pauzira dok traje reklama. Gumb „Postavke privatnosti reklama” u izborniku pojavi se kad UMP to traži.

**Jednom:**
1. [AdMob](https://admob.google.com) → **Apps → Add app → iOS**, poveži s App Store aplikacijom Topple. Zatim **Ad units → Rewarded**, naziv `Savjet`, nagrada 1 `savjet`.
2. App ID i ID jedinice upisani su u `project.yml` (`ADMOB_APP_ID`, `ADMOB_REWARDED_ID`). Debug build (pokretanje iz Xcodea) koristi Googleovu probnu jedinicu, a Release (Archive, TestFlight, App Store) pravu. Vlastite prave reklame nemoj klikati: AdMob to smatra nevaljanim prometom.
3. AdMob → **Privacy & messaging**: poruka za EU (GDPR) već postoji za Android, dodaj joj i iOS aplikaciju. Po želji i **IDFA explainer** (poruka prije Appleova pitanja o praćenju).
4. App Store Connect → **App Privacy**: dodaj podatke koje AdMob prikuplja: *Identifiers → Device ID*, *Usage Data → Advertising Data / Product Interaction*, *Diagnostics → Crash Data / Performance Data*, *Location → Coarse Location*; svi za **Third-Party Advertising**, povezani s uređajem, **Used for tracking: Yes** (za Device ID i Advertising Data).
5. Kad je aplikacija objavljena s reklamama, u AdMobu provjeri `app-ads.txt` (`web/app-ads.txt`, isti izdavač kao Android).

`Info.plist` dobiva `GADApplicationIdentifier`, `NSUserTrackingUsageDescription` (prevedeno u `*.lproj/InfoPlist.strings`) i `SKAdNetworkItems` iz `project.yml`.

## 3. Objava (TestFlight, pa App Store)

**Bez Maca (GitHub Actions):** *Actions → iOS app → Run workflow*, kvačica **release**. Workflow na GitHubovom Macu napravi privremeni distribucijski certifikat i profil (`ios/tools/ci-signing.js`), potpiše i pošalje build (broj = broj runa + 100), napravi verziju iz `MARKETING_VERSION` ako je nema, upiše tekstove iz `AppStore.md` sa „Što je novo”, pričeka obradu builda i odabere ga za verziju, pa certifikat obriše. U App Store Connectu ostaje samo **Add for Review → Submit**. Traje 30–60 minuta.

Jednom: GitHub → Settings → Secrets and variables → Actions → tri tajne od App Store Connect API ključa (*Users and Access → Integrations → Team Keys*, uloga **Admin**, jer se prave certifikati):
- `ASC_KEY_ID`: Key ID (10 znakova)
- `ASC_ISSUER_ID`: Issuer ID (iznad popisa ključeva)
- `ASC_KEY_P8`: cijeli sadržaj datoteke `AuthKey_XXXXXXXXXX.p8` (otvori u uređivaču teksta, kopiraj sve, s redovima BEGIN/END)

**Iz terminala:** `ios/tools/release.sh` poveća broj builda u `project.yml`, pokrene `xcodegen`, napravi Archive i pošalje ga u App Store Connect, s istim API ključem kao ostale skripte:

```bash
ios/tools/release.sh --team TEAMID --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX --issuer xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Dodaj `--version 1.1` za novu javnu verziju. Odabir builda u verziji i slanje na pregled ostaju u App Store Connectu.


1. U Xcodeu gore odaberi **Any iOS Device (arm64)**, pa **Product → Archive**.
2. U Organizeru: **Distribute App → App Store Connect → Upload**.
3. Za desetak minuta build je u App Store Connectu pod **TestFlight**. Tamo dodaj sebe ili testere i instaliraj aplikaciju preko TestFlighta.
4. Kad je sve u redu: **App Store → Prepare for Submission**, odaberi build i **Submit for Review**. Pregled obično traje 1–3 dana.

Za svaku novu verziju povećaj `CURRENT_PROJECT_VERSION` (broj builda) u `project.yml`, a za novu javnu verziju i `MARKETING_VERSION`. Zatim pokreni `xcodegen` i napravi novi Archive.

## Kako je složeno

- `Topple/ToppleApp.swift`: ulaz u aplikaciju, zvuk (ambient), prijava u Game Center.
- `Topple/WebGameView.swift`: WKWebView poslužuje `web/` iz aplikacije na adresi `topple://app/` (`BundleSchemeHandler`). Taj origin server uvijek dopušta (`APP_ORIGIN` u `server/server.js`). Vanjske poveznice otvara u Safariju. Ovdje su i nativni prozori za `alert`/`confirm`/`prompt`.
- `Topple/Native.swift`: haptika, dijeljenje, podsjetnik (`UNUserNotificationCenter`), Game Center.
- `Topple/Store.swift`: Topple Plus (StoreKit 2): stanje, kupnja, vraćanje kupnje; igri javlja `window.topplePlus({owned, price})`.
- `Topple/SignIn.swift`: Sign in with Apple i Google (OAuth s PKCE u `ASWebAuthenticationSession`). ID token vraća igri preko `window.toppleSignedIn`, a igra ga šalje na `/api/apple` ili `/api/google`.
- Web igra prepozna aplikaciju po `location.protocol === 'topple:'` (`APP` u `web/igra.html`, `TOPPLE_IN_APP` u `web/config.js`). Poruke šalje sa `native({ type: ... })`, a vrste su `haptic`, `share`, `remind` i `gc`.
