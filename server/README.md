# Topple API

Mali server za korisničke račune, rezultate i ljestvicu. Samo Node.js, bez npm paketa i bez posebnog servera baze: podaci su u jednoj SQLite datoteci (`topple.db`).

Server ponovno odigra svako poslano rješenje istim `web/core.js` kao igra. Rezultat se sprema samo ako je rješenje stvarno ispravno.

## Što treba

- Node.js 22.5 ili noviji (zbog ugrađenog `node:sqlite`). Provjera: `node -v`.
- Cijeli repozitorij na serveru, jer API čita `web/core.js`, `web/gen.js`, `web/levels.js` i `web/puzzles.js`.

## Pokretanje

```bash
git clone https://github.com/riverDeer12/topple.git
cd topple
PORT=8787 ALLOWED_ORIGIN=https://topple.rdd.software node server/server.js
```

Provjera: `curl http://localhost:8787/api/health` vraća `{"ok":true,...}`.

Postavke (varijable okruženja):

| Varijabla | Zadano | Značenje |
|---|---|---|
| `PORT` | `8787` | port na kojem API sluša |
| `DB_PATH` | `server/topple.db` | datoteka baze |
| `ALLOWED_ORIGIN` | `*` | s kojih adresa igra smije zvati API, odvojeno zarezom, npr. `https://topple.rdd.software,http://localhost:8080` |
| `TZ_GAME` | `Europe/Zagreb` | vremenska zona za dnevnu zagonetku |

## Stalno pokretanje (systemd)

`/etc/systemd/system/topple.service`:

```ini
[Unit]
Description=Topple API
After=network.target

[Service]
WorkingDirectory=/srv/topple
ExecStart=/usr/bin/node server/server.js
Environment=PORT=8787
Environment=ALLOWED_ORIGIN=https://topple.rdd.software
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now topple
```

## HTTPS preko nginxa

Igra je na GitHub Pagesu na `https://topple.rdd.software`, a API na tvom serveru na `https://api.topple.rdd.software`. API mora biti na `https://`, jer preglednik inače blokira pozive.

DNS: `topple` je CNAME na `riverdeer12.github.io.`, a `api.topple` je A zapis na IP servera.

```nginx
server {
  server_name api.topple.rdd.software;
  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

Certifikat: `sudo certbot --nginx -d api.topple.rdd.software`.

## Spajanje igre na server

U `web/config.js` upiši adresu servera i pushaj na `main`:

```js
window.TOPPLE_API = 'https://api.topple.rdd.software';
```

Dok je adresa prazna, igra radi bez servera: prijava je samo lokalna, a ljestvica pokazuje da nije spojena.

## Sigurnosna kopija

Cijela baza je jedna datoteka. Kopija dok server radi:

```bash
sqlite3 server/topple.db ".backup topple-backup.db"
```

Ili zaustavi server i kopiraj `server/topple.db`.

## API

| Metoda i adresa | Opis |
|---|---|
| `POST /api/register` `{name}` | novi račun za uređaj, vraća `{name, token}` |
| `GET /api/me` | profil i napredak (zaglavlje `Authorization: Bearer <token>`) |
| `POST /api/score` `{mode, level/date/n, moves, timeMs}` | rezultat; server provjerava poteze |
| `GET /api/leaderboard?mode=daily&date=YYYY-MM-DD` | dnevna ljestvica (najmanje poteza, pa najbrže) |
| `GET /api/leaderboard?mode=endless` | najviše riješenih u beskonačnom načinu |
| `GET /api/leaderboard?mode=campaign` | najviše zvjezdica u razinama |

`moves` je popis poteza `[[indeksBloka, pomak], ...]`, isti format kao u igri.

Testovi: `npm run test:server` (pokreće server na privremenoj bazi).
