#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - FAZENDINHA ONLINE (v1.3.0)
# ==============================================================================

# Navegar para a pasta do projeto
cd /home/pi/fazendinha_online || exit

# 1. Sincronização Silenciosa com GitHub
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Banco de Dados (PostgreSQL)
# O usuário pi deve ter permissão para rodar sem senha via peer ou .pgpass
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql > /dev/null 2>&1
psql -h localhost -U pi -d farm -f migrations/007_fix_users_table.sql > /dev/null 2>&1

# 3. Backend (PM2)
cd server
npm install --production > /dev/null 2>&1
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
cd ..

# 4. Nginx (Opcional - só reinicia se houver permissão de sudo sem senha)
sudo systemctl restart nginx > /dev/null 2>&1

echo "Deploy finalizado em $(date)" >> /home/pi/fazendinha_online/deploy.log
