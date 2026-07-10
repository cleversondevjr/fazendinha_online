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

<<<<<<< HEAD
# Execução da migração consolidada (Todas em 1)
echo "Executando migração consolidada v5.0.1..."
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/v501_consolidated.sql > /dev/null 2>&1
=======
# Execução das migrações sequencialmente
echo "Executando migrações..."
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/full_deploy.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/007_fix_users_table.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/008_cleanup_users.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/009_roadmap_features.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/010_update_version_v301.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/011_fix_admin_credentials.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/012_reset_admin_plain_text.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/013_update_version_v302.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/014_update_version_v303.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/015_update_version_v304.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/016_update_version_v305.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/017_daily_checkin.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/018_update_version_v306.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/019_spec_v1_schema.sql > /dev/null 2>&1
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/020_update_version_v501.sql > /dev/null 2>&1
>>>>>>> main

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
