#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY AUTOMATIZADO - FAZENDINHA ONLINE (v5.0.1)
# ==============================================================================

PROJECT_PATH="/home/pi/fazendinha_online"
cd "$PROJECT_PATH" || exit

echo "Iniciando deploy em $(date)"

# 1. Sincronização
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Configuração de Variáveis
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
fi

set -a
source server/.env
set +a

# Execução da migração consolidada (Todas em 1)
echo "Executando migração consolidada v5.0.1..."
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/v501_consolidated.sql > /dev/null 2>&1

# 4. Backend (PM2)
echo "Atualizando dependências..."
cd server
npm install --production > /dev/null 2>&1

echo "Reiniciando aplicação..."
# Remove processos e recarrega
pm2 delete fazendinha-backend > /dev/null 2>&1 || true
NODE_ENV=production pm2 start index.js --name "fazendinha-backend" --update-env
pm2 save --force
cd ..

# 5. Nginx
sudo systemctl restart nginx

echo "Deploy finalizado com sucesso em $(date)" >> "$PROJECT_PATH/deploy.log"
echo "Deploy concluído!"
