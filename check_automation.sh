#!/bin/bash

echo "--- Verificação de Automação Fazendinha ---"

# 1. Verificar se o serviço de webhook está rodando
WEBHOOK_PID=$(pgrep -f "webhook")
if [ -z "$WEBHOOK_PID" ]; then
    echo "❌ ERRO: O serviço 'webhook' NÃO está rodando no Raspberry Pi."
    echo "   Rode: screen -S fazendinha_webhook webhook -hooks /home/pi/fazendinha_online/hooks.json -verbose -port 9000"
else
    echo "✅ OK: Serviço de webhook detectado (PID: $WEBHOOK_PID)."
fi

# 2. Verificar se a porta 9000 está aberta
PORT_9000=$(sudo lsof -i :9000)
if [ -z "$PORT_9000" ]; then
    echo "❌ ERRO: Nada está escutando na porta 9000."
else
    echo "✅ OK: Porta 9000 está ativa e escutando."
fi

# 3. Verificar existência do arquivo de log de deploy
if [ -f "/home/pi/fazendinha_online/deploy.log" ]; then
    echo "✅ OK: Log de deploy encontrado. Último deploy em: $(tail -n 1 /home/pi/fazendinha_online/deploy.log)"
else
    echo "⚠️ AVISO: Nenhum log de deploy encontrado ainda."
fi

# 4. Verificar se o script de deploy é executável
if [ -x "/home/pi/fazendinha_online/deploy.sh" ]; then
    echo "✅ OK: deploy.sh tem permissão de execução."
else
    echo "❌ ERRO: deploy.sh não tem permissão de execução. Rode: chmod +x deploy.sh"
fi

echo "-------------------------------------------"
echo "Se tudo estiver OK e o deploy não acontecer:"
echo "1. Verifique se o seu túnel Cloudflare está apontando para a porta 9000."
echo "2. Verifique o log do Webhook no GitHub (Settings -> Webhooks -> Edit -> Recent Deliveries)."
