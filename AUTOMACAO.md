# Automação de Deploy (Webhook + GitHub Actions)

Siga estes passos no seu Raspberry Pi para ativar o deploy automático.

### 1. Instalar o Webhook no Raspberry Pi
```bash
sudo apt-get update
sudo apt-get install webhook
```

### 2. Rodar o servidor de Webhook
Execute o comando abaixo para iniciar o escutador (recomendo usar o `screen` ou `tmux` para deixar rodando):
```bash
webhook -hooks /home/pi/fazendinha_online/hooks.json -verbose -port 9000 &
```

### 3. Configurar no GitHub
1. Vá no seu repositório no GitHub -> **Settings** -> **Webhooks** -> **Add webhook**.
2. **Payload URL**: Use o endereço do seu túnel Cloudflare apontando para a porta 9000.
   - Exemplo: `https://webhook.sgiptv.com.br/hooks/deploy-fazendinha`
3. **Content type**: `application/json`
4. **Which events**: `Just the push event`.

### 4. Ativar Auto-Merge
Para que eu consiga fazer o merge sozinho:
1. Vá em **Settings** -> **General** no GitHub.
2. Ative a opção **Allow auto-merge**.
3. Nos meus Pull Requests, aparecerá um botão para eu marcar como "Auto-merge".

---
Sempre que houver um "Push" na branch `main`, o Raspberry Pi receberá o sinal e rodará o `./deploy.sh` automaticamente.
