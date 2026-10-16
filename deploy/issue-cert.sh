#!/usr/bin/env bash
# Mengambil sertifikat Let's Encrypt untuk temancerita.devmode.biz.id lalu memasangnya ke nginx.
# Dijalankan berkala oleh teman-cerita-cert.timer sampai berhasil, lalu timer menonaktifkan diri.
set -euo pipefail
DOMAIN=temancerita.devmode.biz.id
SSL_DIR=/etc/nginx/ssl/temancerita
LIVE=/etc/letsencrypt/live/$DOMAIN

if [ ! -f "$LIVE/fullchain.pem" ]; then
  certbot certonly --webroot -w /var/www/acme -d "$DOMAIN" --non-interactive --agree-tos --keep-until-expiring --quiet
fi
ln -sfn "$LIVE/fullchain.pem" "$SSL_DIR/fullchain.pem"
ln -sfn "$LIVE/privkey.pem" "$SSL_DIR/privkey.pem"
nginx -t && systemctl reload nginx
systemctl disable --now teman-cerita-cert.timer 2>/dev/null || true
echo "Sertifikat Let's Encrypt terpasang untuk $DOMAIN"
