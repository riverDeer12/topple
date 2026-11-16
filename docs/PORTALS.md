# Topple na portalima za igre (CrazyGames, itch.io)

Web igra se pakira za portale skriptom `tools/package-portal.js` (`crazygames` ili `itch`). Paket je `index.html` (igra) s datotekama koje treba, a u `config.js` postavlja `TOPPLE_PORTAL`. Gotovi zipovi: GitHub → Actions → **Game portals** → zadnji run → Artifacts → `topple-portals` (raspakiraj, unutra su `topple-crazygames.zip` i `topple-itch.zip`). Lokalno: `node tools/package-portal.js crazygames` → `dist/`.

Što je drugačije u paketu (`PORTAL` u `igra.html`):
- računi i ljestvice idu na `https://topple.rdd.software` (server pušta domene portala u CORS, `PORTAL_ORIGIN` u `server.js`);
- nema service workera, podsjetnika (web push), Google prijave ni Topple Plusa; prijava korisničkim imenom radi;
- **CrazyGames:** njihov SDK v3 (`sdk.crazygames.com/crazygames-sdk-v3.js`): reklama s nagradom za savjet (`ad.requestAd('rewarded')`), `gameplayStart`/`gameplayStop` (igra je u tijeku kad nijedan prozor nije otvoren), `happytime` na pobjedi, `loadingStart`/`loadingStop`, njihova postavka za utišavanje zvuka. Poveznice iz izbornika i gumb za dijeljenje su skriveni, prijava se ne nudi sama na početku;
- **itch.io:** nema reklama; poveznice iz izbornika otvaraju topple.rdd.software u novoj kartici.

Svaka promjena web igre ulazi u sljedeći paket; na portalu treba ponovno uploadati zip.

## CrazyGames

1. https://developer.crazygames.com → prijava → **Submit game** (HTML5).
2. Upload `topple-crazygames.zip`. U **QA tool** (pregled prije objave) provjeri: igra se učita, reklama za savjet radi (kad nestane savjeta), zvuk se utiša tijekom reklame.
3. Podaci: naziv `Topple: Gravity Puzzle`, kategorija Puzzle, kontrole: miš / dodir (povuci blok lijevo ili desno), opis ispod. Slike (ikona, naslovna) prema zahtjevima obrasca; snimke ima u `ios/screenshots/` i `android/store/`.
4. Prije slanja pročitaj njihova pravila (Requirements) i provjeri dvije stvari koje ovisno o pravilima možda treba isključiti: vlastiti računi (prijava korisničkim imenom) i ljestvica na našem serveru. Ako ih ne dopuštaju, javi pa ih isključim u paketu.

**Opis (EN):**
> Slide a block and everything above it falls. Topple is a calm logic puzzle with gravity: move blocks left or right, watch the chain reactions, and bring the red block to the exit in as few moves as possible. 120 handcrafted levels in 12 chapters, a new daily puzzle that is the same for everyone, and an endless run that keeps getting harder. Ice slides to the end, stones never move, heavy blocks smash cracked ones, balloons rise, arrows go one way and springs bounce blocks back. Every level has a verified minimum number of moves, so three stars are a real challenge.

## itch.io

1. https://itch.io → **Upload new project**: Kind of project **HTML**, upload `topple-itch.zip`, označi **This file will be played in the browser**.
2. Embed options: **Click to launch in fullscreen** isključeno, veličina okvira npr. 480 × 860 (mobilni omjer) i uključi **Mobile friendly** te **Fullscreen button**.
3. Naziv `Topple: Gravity Puzzle`, Genre Puzzle, tagovi: `puzzle`, `logic`, `gravity`, `sliding-puzzle`, `daily`, `casual`, `brain`, `minimalist`. Opis isti kao za CrazyGames, uz poveznice: web https://topple.rdd.software, App Store https://apps.apple.com/app/id6830289324.
4. Pricing: **No payments** (ili „donate” ako želiš). Visibility: Public.
