#!/bin/bash
echo "--- Desativando versão antiga (/farm) ---"
pm2 stop farm-backend 2>/dev/null || true
pm2 delete farm-backend 2>/dev/null || true
pm2 save --force
sudo rm -f /etc/nginx/sites-enabled/farm 2>/dev/null || true
sudo systemctl restart nginx
echo "Versão antiga desativada."
