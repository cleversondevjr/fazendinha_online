#!/bin/bash

# Auto Deploy Script - Fazendinha Online v1.1.0
# Execute este script para atualizar tudo automaticamente

echo "--- Iniciando Deploy Automático (v1.1.0) ---"

# 1. Sincronizar Código
echo "[1/5] Sincronizando código com o repositório..."
cd /home/pi/fazendinha_online
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Banco de Dados
echo "[2/5] Aplicando migrações de banco de dados..."
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql

# 3. Dependências e Servidor
echo "[3/5] Atualizando dependências e reiniciando backend..."
cd server
npm install
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save

# 4. Nginx
echo "[4/5] Verificando e reiniciando Nginx..."
sudo nginx -t && sudo systemctl restart nginx

# 5. Limpeza de Cache (Sugestão Visual)
echo "[5/5] Deploy concluído com sucesso!"
echo "IMPORTANTE: Se as mudanças não aparecerem, limpe o cache do seu navegador (Ctrl + F5)."
echo "Acesse: https://sgiptv.com.br/fazendinha/"
