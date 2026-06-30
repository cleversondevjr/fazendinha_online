#!/bin/bash

# Diagnóstico de Sistema - Fazendinha Online
echo "--- Relatório de Diagnóstico da Fazendinha ---"
date

echo -e "\n[1] Verificando Versão do Código:"
cd /home/pi/fazendinha_online
git log -1 --pretty=format:"%h - %s (%ad)" --date=relative
grep "v1.0." index.html

echo -e "\n[2] Verificando Portas e Processos:"
pm2 status | grep "fazendinha-backend"
netstat -tunlp | grep 3002

echo -e "\n[3] Verificando Configuração Nginx:"
grep -r "location /fazendinha" /etc/nginx/sites-enabled/
ls -l /home/pi/fazendinha_online/index.html

echo -e "\n[4] Testando Conectividade Backend (Local):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/game/state || echo "FALHA"

echo -e "\n[5] Verificando Erros no Log do Backend:"
pm2 logs fazendinha-backend --lines 20 --no-colors --err

echo -e "\n--- Fim do Diagnóstico ---"
