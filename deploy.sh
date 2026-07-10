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

# 3. Banco de Dados (Executa todos os .sql automaticamente)
echo "Executando migrações..."
for file in migrations/*.sql; do
    echo "Aplicando: $file"
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -f "$file" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "ERRO: Falha ao executar $file"
        exit 1
    fi
done

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
