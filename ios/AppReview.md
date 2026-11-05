# Topple: odgovor App Reviewu (Guideline 2.1, Information Needed)

Apple traži: snimku zaslona s iPhonea i odgovore na 5 pitanja u polju **Notes** (App Store Connect → verzija 1.0 → App Review Information → Notes). Zatim **Add for Review / Resubmit**.

## 1. Demo račun (prije snimanja)

U aplikaciji napravi račun samo za Apple (izbornik → Prijava → Registracija):
- korisničko ime: `AppReview`
- lozinka: neka nova, jaka lozinka (ne koristi svoju)

Upiši ga i u App Review Information → **Sign-in required: Yes**, User name / Password. Ne briši ga (na snimci briši drugi, probni račun).

## 2. Snimka zaslona na iPhoneu

Uključi: Postavke → Kontrolni centar → dodaj **Snimanje zaslona**. iOS mora biti zadnji (Postavke → Općenito → Ažuriranje softvera). Prije snimanja izbriši aplikaciju i instaliraj build iz TestFlighta, da se vidi prvo pokretanje. Zvuk nije potreban. Trajanje 2–4 minute.

Redom:
1. Na početnom zaslonu dodirni ikonu Topplea (snimka mora početi pokretanjem).
2. Pravila igre kod prvog pokretanja → riješi 1. razinu (gost) → zvjezdice.
3. Pokaži „Vrati” i savjet (žarulja) na 2. razini.
4. Izbornik → **Registracija**: napravi probni račun (npr. `ReviewDemo2`) korisničkim imenom i lozinkom. Pokaži da se pojavljuje „Nastavi s Appleom” i „Nastavi s Googleom” (ne moraš dovršiti).
5. Odjava, pa **prijava** istim probnim računom.
6. Dnevna zagonetka → ljestvica (Dnevna / Beskonačno / Razine, Prijatelji).
7. Izbornik → **Topple Plus** → kupnja (u TestFlightu je besplatna, sandbox) → savjeti postaju neograničeni, oznaka PLUS kod imena.
8. Izgled bloka, postignuća, Game Center (ako se pojavi).
9. Izbornik → Profil → **Izbriši račun** → upiši korisničko ime → potvrdi → „Račun je izbrisan”.

Snimku (iz aplikacije Fotografije) priloži u App Review Information → **Attachment** (dopušten je video). Ako je prevelika, stavi je na Google Drive s pristupom „svatko s poveznicom” i poveznicu dodaj na početak Notes.

## 3. Tekst za Notes (kopiraj, engleski, ispod 4000 znakova)

```
Screen recording: attached (App Review Information > Attachment). It starts with launching the app on an iPhone with the latest iOS and shows first launch, playing as a guest, hints and undo, account registration, sign-in, the leaderboards, the Topple Plus in-app purchase, and account deletion (Menu > Profile > Delete account).

Demo account: see the Sign-In Information fields (username + password). Signing in is optional: the app can be played as a guest.

1. PURPOSE AND AUDIENCE
Topple is a logic puzzle game for all ages. You slide blocks left or right; whatever loses its support falls (gravity). The goal is to bring the red block to the exit in as few moves as possible. It offers 120 handcrafted levels in 12 chapters, a daily puzzle that is the same for every player, and an endless series of generated puzzles. The value is a short, calm brain exercise: every level has a verified minimum number of moves, so players can improve and compare results with friends. No ads, no chat, works offline.

2. HOW TO ACCESS THE MAIN FEATURES
- Launch the app: a short rules screen appears, then level 1 starts. No sign-in is needed.
- Guests can play the first 10 levels, 10 endless puzzles and the daily puzzle.
- Menu (bottom) > Sign in: sign in with the demo account, or with Sign in with Apple / Google, or register with a username and password. Signed-in players get all 120 levels, the full endless mode and places on the leaderboards.
- Menu > Levels / Daily puzzle / Endless: game modes. The light bulb button shows a hint (the next best move). Undo and Restart are free.
- Menu > Leaderboard: daily, endless and level leaderboards, also friends only.
- Menu > Topple Plus: a one-time, non-consumable in-app purchase (software.rdd.topple.plus) that gives unlimited hints. Restore purchases is on the same screen. Everything else is free.
- Menu > Profile: statistics, change username/e-mail/password, Delete account (permanently deletes the account and its data on our server and revokes Sign in with Apple).
- Also: block looks, 15 achievements, Game Center leaderboards and achievements, an optional local reminder for the daily puzzle, sharing a result.

User-generated content: the only user-provided content is the username (2-16 letters, digits, space, _ . -), shown on leaderboards and in friend lists. There is no chat, messaging, images or free text. Inappropriate names can be reported to info@rdd.software (link in the app's Contact page) and are renamed or removed by us.

3. EXTERNAL SERVICES
- Our own server (https://topple.rdd.software, operated by us): accounts, verified scores, leaderboards, friends. The game logic and puzzles are inside the app; results are re-verified on the server.
- Sign in with Apple and Google Sign-In (OAuth): optional sign-in.
- Apple StoreKit: the Topple Plus in-app purchase; the signed transaction is verified on our server to show a PLUS badge.
- Apple Game Center: leaderboards and achievements.
- E-mail (SMTP, our own mailbox): password reset links only.
No advertising, analytics, tracking, AI or third-party data providers.

4. REGIONAL DIFFERENCES
None. The app works the same in all regions. It is localized in Croatian, English, Italian and German; the language follows the device.

5. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. All graphics, levels, sounds and code are our own. The background music is our own synthesized performance of J. S. Bach's Prelude in C major (BWV 846), which is in the public domain.
```
