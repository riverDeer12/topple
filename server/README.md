# Topple na vlastitom serveru (Windows + IIS)

Igra i API rade na istom serveru (31.147.206.142), na adresi **https://topple.rdd.software**:

- **IIS** poslužuje igru (mapu `web/`) i HTTPS. Zahtjeve na `/api/` prosljeđuje API-ju; pravila su u `web/web.config`.
- **API** (`server/server.js`) je jedan Node.js proces bez npm paketa, pokrenut kao Windows servis. Podaci su u jednoj SQLite datoteci.
- Server ponovno odigra svako poslano rješenje istim `web/core.js` kao igra. Rezultat se sprema samo ako je rješenje stvarno ispravno.

Sve naredbe upisuju se na serveru, u **PowerShellu pokrenutom kao Administrator**.

## 1. DNS (Namecheap) i GitHub

Advanced DNS za `rdd.software`:

- **A Record**, Host `topple`, Value `31.147.206.142`, TTL Automatic.
- Ako postoji CNAME `topple` → `riverdeer12.github.io.`, obriši ga, jer A i CNAME za isti host ne mogu postojati istovremeno.
- Ako si dodao `api.topple`, obriši i njega, jer više ne treba.

Na GitHubu (repozitorij topple → Settings → Pages) kod **Custom domain** klikni **Remove**. Igra na `riverdeer12.github.io/topple` ostaje kao rezervna kopija, bez ljestvice.

Provjera (može potrajati do sat vremena):

```powershell
Resolve-DnsName topple.rdd.software
```

Mora vratiti `31.147.206.142`.

## 2. Programi

Instaliraj redom, sa zadanim postavkama:

1. **Node.js 22 LTS** (Windows Installer, `.msi`): https://nodejs.org/en/download
2. **Git for Windows**: https://git-scm.com/download/win
3. **IIS URL Rewrite 2.1**: https://www.iis.net/downloads/microsoft/url-rewrite
4. **IIS Application Request Routing 3.0 (ARR)**: https://www.iis.net/downloads/microsoft/application-request-routing
5. **NSSM** (pokreće Node kao Windows servis): https://nssm.cc/download. Raspakiraj i kopiraj `win64\nssm.exe` u `C:\Windows\System32`.

Nakon instalacije zatvori PowerShell i otvori ga ponovno (kao Administrator), da vidi nove programe.

## 3. Instalacija jednom skriptom

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/riverDeer12/topple/main/server/install.ps1 -OutFile $env:TEMP\topple-install.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\topple-install.ps1
```

Skripta `server/install.ps1` napravi sve ovo i nakon svakog koraka provjeri da radi:

1. provjeri da su instalirani svi programi iz 2. koraka
2. uključi proxy u ARR-u (potreban za prosljeđivanje `/api/`)
3. preuzme kod s GitHuba u `C:\inetpub\wwwroot\topple`
4. napravi mapu `C:\inetpub\topple-data` za bazu, zapise i sigurnosne kopije, izvan mape koju IIS poslužuje
5. postavi API kao Windows servis `topple`, koji se sam pokreće nakon restarta servera
6. napravi IIS app pool i stranicu `topple`: mapa `C:\inetpub\wwwroot\topple\web`, port 80, host `topple.rdd.software`
7. napravi zakazani zadatak **Topple update**, koji svake 2 minute instalira novu verziju (vidi „Ažuriranje”)
8. napravi zakazani zadatak **Topple backup** za dnevnu sigurnosnu kopiju baze u 4:30

Skriptu je sigurno pokrenuti više puta, jer preskače ono što je već napravljeno. Drugačije mape zadaju se parametrima, npr. `-AppDir D:\web\topple -DataDir D:\topple-data`.

Pravila za IIS su u `web/web.config` i dolaze s kodom:
- prosljeđivanje `/api/` na API
- preusmjeravanje HTTP-a na HTTPS
- `index.html` kao početna stranica
- isključeno predmemoriranje, da igrači odmah dobiju novu verziju

## 4. HTTPS certifikat (win-acme, besplatno)

Dok certifikat ne postoji, stranica preusmjerava na HTTPS koji još ne radi. Zato ovaj korak napravi odmah nakon instalacije.

1. Preuzmi **win-acme** (x64, pluggable): https://www.win-acme.com, i raspakiraj u `C:\win-acme`.
2. Pokreni `C:\win-acme\wacs.exe` kao Administrator.
3. Odaberi **N** (create certificate, default settings) → odaberi stranicu `topple.rdd.software` → upiši e-mail i prihvati uvjete.

win-acme sam doda HTTPS binding u IIS i napravi zakazani zadatak koji obnavlja certifikat prije isteka.

## 5. Provjera

- **https://topple.rdd.software** otvara igru.
- **https://topple.rdd.software/api/health** vraća `{"ok":true,...}`.
- U igri se na prvom pokretanju prijavi nadimkom. Nakon riješene dnevne zagonetke pojavljuješ se na ljestvici.

Igra sama prepozna da je otvorena s `topple.rdd.software` i spoji se na API na istoj adresi (`web/config.js`), pa ništa ne treba upisivati.

## Ažuriranje: automatski

Svaka nova verzija spojena u `main` na GitHubu sama dođe na server unutar 2 minute. Zakazani zadatak **Topple update** pokreće `server/update.ps1`, koja:

1. provjeri ima li na GitHubu novija verzija; ako nema, odmah završi
2. preuzme je u `C:\inetpub\wwwroot\topple`; igra se time odmah ažurira, jer je IIS poslužuje izravno iz te mape
3. ponovno pokrene API i provjeri da radi

Zapis svih ažuriranja: `C:\inetpub\topple-data\update.log`. Ručno ažuriranje (PowerShell kao Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\topple\server\update.ps1
```

Kod na serveru se ne uređuje ručno: svaka izmjena u `C:\inetpub\wwwroot\topple` bit će prebrisana verzijom s GitHuba. Baza je u `C:\inetpub\topple-data` i ažuriranje je ne dira.

## Sigurnosna kopija

Zadatak **Topple backup** svaki dan u 4:30 kopira bazu u `C:\inetpub\topple-data`. Čuva se po jedna kopija za svaki dan u tjednu (`backup-pon.db` … `backup-ned.db`). Ručna kopija:

```powershell
node C:\inetpub\wwwroot\topple\server\backup.js C:\inetpub\topple-data\topple.db
```

## Zapisi i problemi

- API: `C:\inetpub\topple-data\api.log`
- ažuriranja: `C:\inetpub\topple-data\update.log`
- **500.19** u IIS-u: nije instaliran URL Rewrite.
- **502.3** na `/api/`: API servis ne radi (`Get-Service topple`, pa `Start-Service topple`) ili ARR proxy nije uključen.

## Prijava s Googleom (neobavezno)

Prijava korisničkim imenom ili e-mailom i lozinkom radi odmah. Za gumb „Prijava s Googleom” treba besplatni Google OAuth Client ID:

1. Otvori https://console.cloud.google.com i napravi projekt (npr. „Topple”).
2. **APIs & Services → OAuth consent screen:** User type **External**, naziv aplikacije „Topple”, tvoj e-mail, pa spremi. Pod **Publishing status** klikni **Publish app**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://topple.rdd.software`
   - **Create**, pa kopiraj **Client ID** (završava na `.apps.googleusercontent.com`).
4. Na serveru (PowerShell kao Administrator) ponovno pokreni instalacijsku skriptu s tim ID-jem:

```powershell
powershell -ExecutionPolicy Bypass -File C:\inetpub\wwwroot\topple\server\install.ps1 -GoogleClientId "TVOJ-ID.apps.googleusercontent.com"
```

Skripta postavi `GOOGLE_CLIENT_ID` za API i ponovno ga pokrene. Gumb se u igri pojavi sam. Server mora moći dohvatiti `https://www.googleapis.com/oauth2/v3/certs` (Googleovi javni ključevi za provjeru prijave).

## Zaboravljena lozinka (slanje e-maila)

Igrač koji ima e-mail na računu može u prijavi kliknuti „Zaboravljena lozinka?”. Server mu pošalje poveznicu koja vrijedi 1 sat. Nakon nove lozinke odjavljuju se svi ostali uređaji. Za slanje treba SMTP pristup nekom poštanskom sandučiću, npr. onom za `info@rdd.software`:

| Pošta | Poslužitelj | Port |
|---|---|---|
| Namecheap Private Email | `mail.privateemail.com` | 465 |
| Google Workspace / Gmail (lozinka za aplikacije) | `smtp.gmail.com` | 587 |
| Zoho Mail (EU) | `smtp.zoho.eu` | 465 |
| Brevo (besplatno do 300 e-mailova dnevno) | `smtp-relay.brevo.com` | 587 |

Na serveru (lozinku u PowerShellu stavi u jednostruke navodnike):

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js set-smtp mail.privateemail.com 465 info@rdd.software 'lozinka' "Topple <info@rdd.software>" --db C:\inetpub\topple-data\topple.db
node C:\inetpub\wwwroot\topple\server\admin.js test-mail tvoj@email.com --db C:\inetpub\topple-data\topple.db
```

Postavke se spremaju u `C:\inetpub\topple-data\smtp.json` (nije u gitu). API ih čita sam, bez ponovnog pokretanja, a poveznica „Zaboravljena lozinka?” pojavi se u igri čim je SMTP postavljen. Port 465 koristi TLS od početka, ostali STARTTLS.

## Podsjetnik za dnevnu zagonetku

Igrači u izborniku mogu uključiti podsjetnik (obavijest na mobitelu ili računalu). Ne treba ništa postavljati: API pri prvom pokretanju napravi ključ `C:\inetpub\topple-data\vapid.json`. Tu datoteku ne briši i ne mijenjaj, inače prestaju raditi sve postojeće pretplate. Server mora moći slati na push servise (`fcm.googleapis.com`, `*.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`).

## Sigurnosne kopije na Google Drive

Zadatak **Topple backup** svaki dan u 4:30 napravi lokalnu kopiju i, kad je Google Drive povezan, pošalje kopiju s datumom (`topple-2026-11-03.db`) u mapu **RDD → DB_Backups → Topple** na tvom Driveu. Tamo se čuva zadnjih 30 kopija, starije se brišu same. Skripta smije vidjeti samo datoteke koje je sama napravila (dozvola `drive.file`), ništa drugo na Driveu. Zapis: `C:\inetpub\topple-data\backup.log`.

Jednokratno povezivanje:

1. **Google Cloud** (projekt Topple) → **APIs & Services → Library** → potraži **Google Drive API** → **Enable**.
2. **Google Auth Platform → Clients → Create client**: Application type **Desktop app**, Name `Topple backup` → **Create** → **Download JSON**.
3. Kopiraj preuzetu datoteku na server, npr. u `C:\inetpub\topple-data\gdrive-client.json`.
4. Na serveru (PowerShell):

```powershell
node C:\inetpub\wwwroot\topple\server\gdrive-auth.js C:\inetpub\topple-data\gdrive-client.json --db C:\inetpub\topple-data\topple.db
```

5. Skripta ispiše link. Otvori ga u pregledniku (može i na svom računalu), odaberi svoj Google račun i dopusti pristup. Ako Google upozori „Google hasn't verified this app”, klikni **Advanced → Go to Topple** (to je tvoja aplikacija).
6. Preglednik zatim otvori adresu koja počinje s `http://127.0.0.1:53682/?code=...` i javi da se stranica ne može otvoriti. To je očekivano: kopiraj cijelu adresu i zalijepi je u PowerShell. (Ako je preglednik na samom serveru, ovaj korak ide sam.)
7. Proba: `node C:\inetpub\wwwroot\topple\server\backup.js C:\inetpub\topple-data\topple.db` — kopija se mora pojaviti na Driveu.

Ako na Driveu već imaš svoju mapu **RDD**, skripta je ne vidi (dozvola `drive.file`) i napravi svoju. Mapu **Topple** koju je skripta napravila možeš premjestiti u svoju RDD → DB_Backups, a višak obrisati: skripta pamti mapu i nastavlja slati u nju.

Dozvola je spremljena u `C:\inetpub\topple-data\gdrive.json` (izvan weba). Za prekid: obriši tu datoteku ili ukloni pristup na https://myaccount.google.com/permissions.

## Reklame za savjete (Google AdSense)

Igra nudi reklamu s nagradom kad igraču nestane savjeta. Dok AdSense nije uključen, umjesto reklame se prikazuje probni prozor od 5 sekundi (`simulate: true` u `web/config.js`).

1. Otvori https://adsense.google.com i napravi račun (podaci i bankovni račun za isplatu).
2. **Sites → Add site:** `topple.rdd.software`. AdSense provjeri stranicu; to može trajati od nekoliko dana do par tjedana.
3. Prijavi se za reklame u igrama (**H5 Games Ads**, obrazac u AdSense pomoći pod „Ad Placement API”).
4. **Privacy & messaging → European regulations:** napravi i objavi Googleov obrazac privole (besplatan). Prikazuje se igračima u EU-u prije reklama.
5. U `web/config.js` upiši svoj ID: `window.TOPPLE_ADS = { client: 'ca-pub-…', test: true, simulate: true };`. S `test: true` Google prikazuje probne reklame. Kad AdSense odobri stranicu, stavi `test: false`.
6. Napravi datoteku `web/ads.txt` s jednim retkom (AdSense ga traži): `google.com, pub-…, DIRECT, f08c47fec0942fa0` (tvoj broj bez `ca-`).

Stanje: AdSense račun `pub-8378829605116517`, stranica `rdd.software` (pokriva i poddomenu). `ads.txt` i oznaka `google-adsense-account` su u repozitoriju riverDeer12/rdd i u `web/ads.txt` ovdje; `config.js` ima ID uz `test: true`. Kad AdSense odobri stranicu, stavi `test: false`.

Promjene pushaj na `main`; server ih preuzme sam. Pravila privatnosti su na `privatnost.html`.

## Upravljanje računima

Popis igrača i načina prijave:

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js list --db C:\inetpub\topple-data\topple.db
```

Postojećem igraču postavi e-mail i lozinku (kao da se tako registrirao):

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js set-login Ime ime@example.com "lozinka" --db C:\inetpub\topple-data\topple.db
```

Samo nova lozinka: `set-password Ime "lozinka"`.

Statistika igrača i gostiju (koliko ih ima, koliko je aktivno danas / 7 / 30 dana, dokle gosti stižu, koliko ih se registriralo):

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js stats --db C:\inetpub\topple-data\topple.db
```

Brisanje igrača i svih njegovih podataka (rezultati, ljestvice, prijave na uređajima). Bez `--yes` samo pokaže što bi se obrisalo:

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js delete Ime --db C:\inetpub\topple-data\topple.db
node C:\inetpub\wwwroot\topple\server\admin.js delete Ime --yes --db C:\inetpub\topple-data\topple.db
``` Lozinku stavi u navodnike ako sadrži znakove poput `#` ili razmaka.

## Administracija (/admin)

Na `https://topple.rdd.software/admin` je pregled za vlasnika: koliko ih trenutno igra, registrirani igrači i gosti, aktivnost po danima, koliko je igrača riješilo svaku razinu, tko je najdalje stigao, novi igrači i gosti. Osvježava se svake minute.

Prijava nije u kodu (repozitorij je javan): administratora postavi na serveru. Lozinku u PowerShellu stavi u **jednostruke** navodnike (zbog `$`), najmanje 10 znakova:

```powershell
node C:\inetpub\wwwroot\topple\server\admin.js set-admin Ime 'lozinka' --db C:\inetpub\topple-data\topple.db
```

Ista naredba mijenja lozinku i odjavljuje sve stare prijave tog administratora. Prijava traje 7 dana.

## Postavke API-ja

| Varijabla | Zadano | Značenje |
|---|---|---|
| `PORT` | `8787` | port na kojem API sluša |
| `HOST` | `127.0.0.1` | adresa na kojoj API sluša; lokalno, jer je ispred IIS |
| `DB_PATH` | `server/topple.db` | datoteka baze |
| `ALLOWED_ORIGIN` | `*` | s kojih drugih adresa igra smije zvati API, odvojeno zarezom |
| `TZ_GAME` | `Europe/Zagreb` | vremenska zona za dnevnu zagonetku |
| `GOOGLE_CLIENT_ID` | (prazno) | Google OAuth Client ID; prazno = bez gumba „Prijava s Googleom” |
| `REMIND_HOUR` | `17` | sat (po `TZ_GAME`) kad se šalje podsjetnik za dnevnu zagonetku |
| `PUBLIC_URL` | `https://topple.rdd.software` | adresa igre u e-mailu za novu lozinku |
| `SMTP_HOST` … | (prazno) | umjesto `smtp.json`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

Promjena postavki: `nssm edit topple` (kartica Environment), pa `Restart-Service topple`. Zadane vrijednosti postavlja `install.ps1`.

## API

| Metoda i adresa | Opis |
|---|---|
| `GET /api/health` | provjera rada |
| `GET /api/config` | javne postavke (Google Client ID) |
| `POST /api/register` `{name, password, email?}` | novi račun, vraća `{name, token}` |
| `POST /api/login` `{login, password}` | prijava korisničkim imenom ili e-mailom |
| `POST /api/google` `{credential}` | prijava ili registracija Googleom; s tokenom povezuje Google s računom |
| `POST /api/account` `{email?, password?, currentPassword?}` | dodaj ili promijeni e-mail i lozinku |
| `POST /api/logout` | odjava s ovog uređaja |
| `GET /api/stats` | broj igrača i riješenih zagonetki |
| `POST /api/admin/login` `{user, password}` | prijava administratora (tablica `admins`), vraća `{token}` |
| `GET /api/admin/stats` | statistika za /admin (Bearer token administratora) |
| `POST /api/forgot` `{login, lang}` | e-mail s poveznicom za novu lozinku (isti odgovor i kad računa nema) |
| `POST /api/reset` `{token, password}` | nova lozinka iz poveznice, vraća `{name, token}` |
| `GET /api/me` | profil i napredak (zaglavlje `Authorization: Bearer <token>`) |
| `POST /api/score` `{mode, level/date/n, moves, timeMs}` | rezultat; server provjerava poteze |
| `GET /api/leaderboard?mode=daily&date=YYYY-MM-DD` | dnevna ljestvica (najmanje poteza, pa najbrže) |
| `GET /api/leaderboard?mode=endless` | najviše riješenih u beskonačnom načinu |
| `GET /api/leaderboard?mode=campaign` | najviše zvjezdica u razinama |

`moves` je popis poteza `[[indeksBloka, pomak], ...]`, isti format kao u igri.

Testovi: `npm run test:server` (pokreće API na privremenoj bazi).
