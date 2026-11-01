#!/bin/sh
# Updates the game and the API on the server to the latest main branch.
# Run on the server: sudo /srv/topple/server/deploy.sh
set -e
cd /srv/topple
sudo -u topple git pull --ff-only
systemctl restart topple
sleep 1
curl -fsS http://127.0.0.1:8787/api/health && echo
