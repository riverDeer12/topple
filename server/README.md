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

## Postavke API-ja

| Varijabla | Zadano | Značenje |
|---|---|---|
| `PORT` | `8787` | port na kojem API sluša |
| `HOST` | `127.0.0.1` | adresa na kojoj API sluša; lokalno, jer je ispred IIS |
| `DB_PATH` | `server/topple.db` | datoteka baze |
| `ALLOWED_ORIGIN` | `*` | s kojih drugih adresa igra smije zvati API, odvojeno zarezom |
| `TZ_GAME` | `Europe/Zagreb` | vremenska zona za dnevnu zagonetku |

Promjena postavki: `nssm edit topple` (kartica Environment), pa `Restart-Service topple`. Zadane vrijednosti postavlja `install.ps1`.

## API

| Metoda i adresa | Opis |
|---|---|
| `GET /api/health` | provjera rada |
| `POST /api/register` `{name}` | novi račun za uređaj, vraća `{name, token}` |
| `GET /api/me` | profil i napredak (zaglavlje `Authorization: Bearer <token>`) |
| `POST /api/score` `{mode, level/date/n, moves, timeMs}` | rezultat; server provjerava poteze |
| `GET /api/leaderboard?mode=daily&date=YYYY-MM-DD` | dnevna ljestvica (najmanje poteza, pa najbrže) |
| `GET /api/leaderboard?mode=endless` | najviše riješenih u beskonačnom načinu |
| `GET /api/leaderboard?mode=campaign` | najviše zvjezdica u razinama |

`moves` je popis poteza `[[indeksBloka, pomak], ...]`, isti format kao u igri.

Testovi: `npm run test:server` (pokreće API na privremenoj bazi).
