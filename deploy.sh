#!/bin/bash

# ==============================================================================
# SCRIPT DE DEPLOY ÚNICO - FAZENDINHA ONLINE (v1.2.0)
# Use este script para atualizar TUDO (Frontend, Assets, Banco e Backend)
# ==============================================================================

# Cores para saída
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}>>> Iniciando atualização completa da Fazendinha Online...${NC}"

# 1. Sincronização com GitHub
echo -e "\n${GREEN}[1/5] Sincronizando arquivos com o GitHub...${NC}"
git fetch origin
git reset --hard origin/main
git clean -fd

# 2. Configurações de Ambiente
if [ ! -f server/.env ]; then
    echo -e "${RED}AVISO: Arquivo server/.env não encontrado! Criando a partir do exemplo...${NC}"
    cp server/.env.example server/.env
    echo -e "${RED}IMPORTANTE: Edite server/.env com as credenciais do seu banco de dados.${NC}"
fi

# 3. Banco de Dados (PostgreSQL)
echo -e "\n${GREEN}[2/5] Atualizando estrutura do Banco de Dados...${NC}"
# Executa o full_deploy primeiro para garantir tabelas base, depois correções específicas
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql
psql -h localhost -U pi -d farm -f migrations/007_fix_users_table.sql

# 4. Dependências e Processos (Node.js/PM2)
echo -e "\n${GREEN}[3/5] Instalando dependências e reiniciando o servidor...${NC}"
cd server
npm install --production
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
cd ..

# 5. Servidor Web (Nginx)
echo -e "\n${GREEN}[4/5] Reiniciando Nginx para limpar rotas...${NC}"
sudo systemctl restart nginx

# 6. Finalização
echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${GREEN}DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "Acesse: https://sgiptv.com.br/fazendinha/"
echo -e "\n${RED}DICA: Se o site não atualizar, pressione CTRL + F5 no navegador.${NC}"
echo -e "${GREEN}==============================================================================${NC}"
