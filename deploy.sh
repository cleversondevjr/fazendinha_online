#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - FAZENDINHA ONLINE (v5.0.1)
# ==============================================================================

# Navegar para a pasta do projeto
cd /home/pi/fazendinha_online || exit

# 1. Sincronização Silenciosa com GitHub
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Banco de Dados (PostgreSQL)
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "AVISO: Arquivo .env criado a partir do exemplo."
fi

# Carrega as variáveis do .env para as migrações (modo robusto com set -a)
set -a
source server/.env
set +a

# Execução da migração consolidada (Todas em 1)
echo "Executando migração consolidada v5.0.1..."
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/v501_consolidated.sql > /dev/null 2>&1

# 3. Backend (PM2)
cd server
npm install --production > /dev/null 2>&1
echo "Limpando processos na porta 3002..."
sudo fuser -k 3002/tcp > /dev/null 2>&1 || true
pm2 delete fazendinha-backend > /dev/null 2>&1 || true
NODE_ENV=production pm2 start index.js --name "fazendinha-backend" --update-env
pm2 save --force
cd ..

# 4. Nginx
sudo systemctl restart nginx > /dev/null 2>&1 || true

echo "Deploy finalizado em $(date)" >> /home/pi/fazendinha_online/deploy.log
