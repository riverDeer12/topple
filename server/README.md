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

Zatvori i ponovno otvori PowerShell, pa provjeri:

```powershell
node -v
git --version
nssm version
```

`node -v` mora pokazati v22.5 ili noviju verziju.

**Uključi proxy u ARR-u** (bez toga IIS neće prosljeđivati `/api/`):
IIS Manager → klikni naziv servera (na vrhu lijevo) → **Application Request Routing Cache** → desno **Server Proxy Settings…** → označi **Enable proxy** → **Apply**.

## 3. Kod i mapa za bazu

```powershell
git clone https://github.com/riverDeer12/topple.git C:\topple
New-Item -ItemType Directory -Force C:\topple-data
```

Baza će biti u `C:\topple-data\topple.db`, odvojeno od koda, pa je ažuriranje koda ne dira.

## 4. API kao Windows servis

```powershell
nssm install topple "C:\Program Files\nodejs\node.exe" "C:\topple\server\server.js"
nssm set topple AppDirectory C:\topple
nssm set topple AppEnvironmentExtra PORT=8787 DB_PATH=C:\topple-data\topple.db ALLOWED_ORIGIN=https://topple.rdd.software,https://riverdeer12.github.io
nssm set topple AppStdout C:\topple-data\api.log
nssm set topple AppStderr C:\topple-data\api.log
nssm set topple Start SERVICE_AUTO_START
Start-Service topple
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

Zadnja naredba mora vratiti `ok: True`. Servis se sam pokreće nakon restarta servera. Zapisi su u `C:\topple-data\api.log`.

API sluša samo na `127.0.0.1`, pa izvana nije dostupan mimo IIS-a i port 8787 ne treba otvarati u vatrozidu.

## 5. IIS stranica

1. IIS Manager → **Sites** → desni klik → **Add Website…**
   - **Site name:** `topple`
   - **Physical path:** `C:\topple\web`
   - **Binding:** Type `http`, IP address `All Unassigned`, Port `80`, Host name `topple.rdd.software`
   - **OK**
2. Otvori http://topple.rdd.software u pregledniku na serveru ili na svom računalu. Moraš vidjeti igru.
3. Otvori http://topple.rdd.software/api/health. Moraš vidjeti `{"ok":true,...}`.

Datoteka `C:\topple\web\web.config` već sadrži sva pravila:
- prosljeđivanje `/api/` na API
- preusmjeravanje HTTP-a na HTTPS (počinje vrijediti kad postoji HTTPS binding)
- `index.html` kao početnu stranicu
- isključeno predmemoriranje, da igrači odmah dobiju nove verzije

Ako IIS javi grešku **500.19**, nije instaliran URL Rewrite (2. korak).

## 6. HTTPS certifikat (win-acme, besplatno)

1. Preuzmi **win-acme** (x64, pluggable): https://www.win-acme.com, i raspakiraj u `C:\win-acme`.
2. Pokreni `C:\win-acme\wacs.exe` kao Administrator.
3. Odaberi **N** (create certificate, default settings) → odaberi stranicu `topple` → potvrdi `topple.rdd.software` → upiši e-mail i prihvati uvjete.

win-acme sam doda HTTPS binding u IIS i napravi zakazani zadatak koji obnavlja certifikat prije isteka.

## 7. Provjera

- **https://topple.rdd.software** otvara igru.
- **https://topple.rdd.software/api/health** vraća `{"ok":true,...}`.
- U igri se na prvom pokretanju prijavi nadimkom. Nakon riješene dnevne zagonetke pojavljuješ se na ljestvici.

Igra sama prepozna da je otvorena s `topple.rdd.software` i spoji se na API na istoj adresi (`web/config.js`), pa ništa ne treba upisivati.

## Ažuriranje

Kad se promjene spoje u `main` na GitHubu, na serveru u PowerShellu kao Administrator:

```powershell
C:\topple\server\deploy.ps1
```

Skripta povuče novi kod, ponovno pokrene API i provjeri da radi. Igra se ažurira odmah, jer IIS poslužuje datoteke izravno iz `C:\topple\web`.

Ako PowerShell ne dopušta pokretanje skripti, jednom pokreni `Set-ExecutionPolicy RemoteSigned`.

## Sigurnosna kopija

Cijela baza je jedna datoteka. Kopija dok API radi (čuva po jednu kopiju za svaki dan u tjednu, `backup-pon.db` … `backup-ned.db`):

```powershell
node C:\topple\server\backup.js C:\topple-data\topple.db
```

Svakodnevna automatska kopija u 4:30:

```powershell
schtasks /Create /TN "Topple backup" /SC DAILY /ST 04:30 /RU SYSTEM /TR "\"C:\Program Files\nodejs\node.exe\" C:\topple\server\backup.js C:\topple-data\topple.db"
```

## Postavke API-ja

| Varijabla | Zadano | Značenje |
|---|---|---|
| `PORT` | `8787` | port na kojem API sluša |
| `HOST` | `127.0.0.1` | adresa na kojoj API sluša; lokalno, jer je ispred IIS |
| `DB_PATH` | `server/topple.db` | datoteka baze |
| `ALLOWED_ORIGIN` | `*` | s kojih drugih adresa igra smije zvati API, odvojeno zarezom |
| `TZ_GAME` | `Europe/Zagreb` | vremenska zona za dnevnu zagonetku |

Promjena postavki: `nssm edit topple` (kartica Environment), pa `Restart-Service topple`.

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
