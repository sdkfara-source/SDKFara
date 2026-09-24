#!/usr/bin/env bash
set -euo pipefail

# install_caddy.sh — تثبيت Caddy (HTTPS تلقائي) على Ubuntu
# بعدها: sudo cp deploy/Caddyfile /etc/caddy/Caddyfile ثم عدّل النطاق، و sudo systemctl reload caddy

sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update
sudo apt-get install -y caddy
caddy version