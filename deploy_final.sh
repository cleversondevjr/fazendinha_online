#!/bin/bash

# Script de Deploy Final - Fazendinha Online
# Alvo: Raspberry Pi 3 (pi@192.168.0.217)

echo "--- INICIANDO DEPLOY DA FAZENDINHA ONLINE ---"

# 1. Navegar para a raiz do projeto
cd /home/pi/fazendinha_online || { echo "Diretório não encontrado!"; exit 1; }

# 2. Atualizar dependências do Backend
echo "Instalando dependências..."
cd server
npm install

# 3. Configurar Variáveis de Ambiente se não existirem
if [ ! -f .env ]; then
    echo "Criando .env padrão..."
    cp .env.example .env
fi

# 4. Executar Migrações do Banco de Dados
echo "Executando migrações (PostgreSQL)..."
# Assumindo que o usuário tem o psql instalado e configurado
psql -h localhost -U pi -d farm -f ../migrations/full_deploy.sql

# 5. Reiniciar o Servidor via PM2
echo "Reiniciando servidor backend..."
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save

# 6. Diagnóstico Final
echo "Rodando diagnóstico de banco de dados..."
node db_diag.js

echo "--- DEPLOY CONCLUÍDO COM SUCESSO ---"
echo "Acesse: https://sgiptv.com.br/fazendinha/"
