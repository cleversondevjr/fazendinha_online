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
# Garante que o .env no servidor use a senha correta
echo "PORT=3002
PGHOST=localhost
PGUSER=pi
PGPASSWORD=Wincster194060le
PGDATABASE=farm
PGPORT=5432
SESSION_SECRET=fazendinha-secret-998
NODE_ENV=production" > server/.env

# Usando a senha do usuário pi para rodar as migrações
export PGPASSWORD="Wincster194060le"
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql > /dev/null 2>&1
psql -h localhost -U pi -d farm -f migrations/007_fix_users_table.sql > /dev/null 2>&1

# 3. Backend (PM2)
cd server
npm install --production > /dev/null 2>&1
# Reinicia o backend sem pedir confirmação
pm2 restart fazendinha-backend --update-env || pm2 start index.js --name "fazendinha-backend"
pm2 save --force
cd ..

# 4. Nginx (Opcional - tenta reiniciar de forma silenciosa)
sudo systemctl restart nginx > /dev/null 2>&1 || true

echo "Deploy finalizado em $(date)" >> /home/pi/fazendinha_online/deploy.log
