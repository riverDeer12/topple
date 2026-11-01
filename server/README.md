# Topple na vlastitom serveru

Igra i API rade na istom serveru, na adresi **https://topple.rdd.software**:

- **nginx** poslužuje igru (mapu `web/`) i HTTPS, a zahtjeve na `/api/` prosljeđuje API-ju.
- **API** (`server/server.js`) je jedan Node.js proces bez npm paketa. Podaci su u jednoj SQLite datoteci.
- Server ponovno odigra svako poslano rješenje istim `web/core.js` kao igra. Rezultat se sprema samo ako je rješenje stvarno ispravno.

Upute pretpostavljaju Ubuntu ili Debian i pristup serveru preko SSH-a s `sudo` pravima. Naredbe se upisuju na serveru (31.147.206.142).

## 1. DNS (Namecheap)

Advanced DNS za `rdd.software`:

- **A Record**, Host `topple`, Value `31.147.206.142`, TTL Automatic.
- Ako postoji CNAME `topple` → `riverdeer12.github.io.`, obriši ga, jer A i CNAME za isti host ne mogu postojati istovremeno.
- Ako si dodao `api.topple`, obriši i njega, jer više ne treba.

Na GitHubu (repozitorij topple → Settings → Pages) kod **Custom domain** klikni **Remove**. Igra na GitHub Pagesu i dalje postoji na `riverdeer12.github.io/topple` kao rezervna kopija, ali bez ljestvice.

Provjera s bilo kojeg računala (može potrajati do sat vremena):

```bash
nslookup topple.rdd.software
```

Mora vratiti `31.147.206.142`.

## 2. Programi

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx sqlite3 curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

`node -v` mora pokazati v22.5 ili noviju verziju.

Ako je uključen vatrozid `ufw`, otvori HTTP i HTTPS:

```bash
sudo ufw allow 'Nginx Full'
```

## 3. Korisnik, kod i mapa za bazu

API radi pod posebnim korisnikom `topple` koji nema druga prava na serveru.

```bash
sudo useradd --system --home /srv/topple --shell /usr/sbin/nologin topple
sudo git clone https://github.com/riverDeer12/topple.git /srv/topple
sudo chown -R topple:topple /srv/topple
sudo mkdir -p /var/lib/topple
sudo chown topple:topple /var/lib/topple
```

Baza će biti u `/var/lib/topple/topple.db`, odvojeno od koda, pa je ažuriranje koda ne dira.

## 4. API kao stalni servis (systemd)

```bash
sudo nano /etc/systemd/system/topple.service
```

Sadržaj:

```ini
[Unit]
Description=Topple API
After=network.target

[Service]
User=topple
WorkingDirectory=/srv/topple
ExecStart=/usr/bin/node server/server.js
Environment=PORT=8787
Environment=DB_PATH=/var/lib/topple/topple.db
Environment=ALLOWED_ORIGIN=https://topple.rdd.software,https://riverdeer12.github.io
Restart=always

[Install]
WantedBy=multi-user.target
```

Pokretanje i provjera:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now topple
curl http://127.0.0.1:8787/api/health
```

Odgovor mora biti `{"ok":true,"today":"..."}`. Zapisi servisa: `sudo journalctl -u topple -f`.

## 5. nginx: igra i API na istoj adresi

```bash
sudo nano /etc/nginx/sites-available/topple
```

Sadržaj:

```nginx
server {
  listen 80;
  server_name topple.rdd.software;

  root /srv/topple/web;
  index index.html;

  # Game files: browsers re-check them, so players get updates right away.
  location / {
    try_files $uri $uri/ =404;
    add_header Cache-Control "no-cache";
  }

  # API
  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 64k;
  }

  gzip on;
  gzip_types application/javascript application/json text/css;
}
```

Uključivanje:

```bash
sudo ln -s /etc/nginx/sites-available/topple /etc/nginx/sites-enabled/topple
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` mora reći `syntax is ok` i `test is successful`.

## 6. HTTPS certifikat

Kad DNS iz 1. koraka pokazuje na server:

```bash
sudo certbot --nginx -d topple.rdd.software
```

Certbot sam doda HTTPS u nginx konfiguraciju i postavi automatsko obnavljanje certifikata. Na pitanje o preusmjeravanju odaberi preusmjeravanje HTTP-a na HTTPS.

## 7. Provjera

- **https://topple.rdd.software** otvara igru.
- **https://topple.rdd.software/api/health** vraća `{"ok":true,...}`.
- U igri se na prvom pokretanju prijavi nadimkom. Nakon riješene dnevne zagonetke pojavljuješ se na ljestvici.

Igra sama prepozna da je otvorena s `topple.rdd.software` i spoji se na API na istoj adresi (`web/config.js`), pa ništa ne treba upisivati.

## Ažuriranje

Kad se promjene spoje u `main` na GitHubu, na serveru pokreni:

```bash
sudo /srv/topple/server/deploy.sh
```

Skripta povuče novi kod, ponovno pokrene API i provjeri da radi. Igra se ažurira odmah, jer nginx poslužuje datoteke izravno iz `/srv/topple/web`.

## Sigurnosna kopija

Cijela baza je jedna datoteka. Kopija dok server radi:

```bash
sudo -u topple sqlite3 /var/lib/topple/topple.db ".backup /var/lib/topple/backup-$(date +%F).db"
```

Za svakodnevnu automatsku kopiju dodaj u `sudo crontab -e`:

```cron
30 4 * * * sudo -u topple sqlite3 /var/lib/topple/topple.db ".backup /var/lib/topple/backup-$(date +\%u).db"
```

Tako se čuva po jedna kopija za svaki dan u tjednu.

## Postavke API-ja

| Varijabla | Zadano | Značenje |
|---|---|---|
| `PORT` | `8787` | port na kojem API sluša |
| `HOST` | `127.0.0.1` | adresa na kojoj API sluša; lokalno, jer je ispred nginx |
| `DB_PATH` | `server/topple.db` | datoteka baze |
| `ALLOWED_ORIGIN` | `*` | s kojih drugih adresa igra smije zvati API, odvojeno zarezom |
| `TZ_GAME` | `Europe/Zagreb` | vremenska zona za dnevnu zagonetku |

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
