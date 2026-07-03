#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - FAZENDINHA ONLINE (v2.1.0)
# ==============================================================================

# Navegar para a pasta do projeto
cd /home/pi/fazendinha_online || exit

# 1. Sincronização Silenciosa com GitHub
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Banco de Dados (PostgreSQL)
# O arquivo .env deve ser mantido localmente no servidor por segurança.
# Caso não exista, ele será criado a partir do exemplo, mas as credenciais
# reais devem ser configuradas manualmente uma única vez no servidor.
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "AVISO: Arquivo .env criado a partir do exemplo. Configure as credenciais reais no servidor."
fi

# Carrega as variáveis do .env para as migrações
export $(grep -v '^#' server/.env | xargs)

# Execução das migrações
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/full_deploy.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/007_fix_users_table.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/008_cleanup_users.sql > /dev/null 2>&1

# 3. Backend (PM2)
cd server
npm install --production > /dev/null 2>&1
pm2 restart fazendinha-backend --update-env || pm2 start index.js --name "fazendinha-backend"
pm2 save --force
cd ..

# 4. Nginx
sudo systemctl restart nginx > /dev/null 2>&1 || true

echo "Deploy finalizado em $(date)" >> /home/pi/fazendinha_online/deploy.log
