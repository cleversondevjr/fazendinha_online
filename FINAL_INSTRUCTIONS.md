# Instruções Finais de Deploy - Fazendinha Online

Este guia resume os passos necessários para ativar as atualizações visuais e estruturais no seu Raspberry Pi 3.

## 1. Sincronizar o Código
No terminal do seu Raspberry Pi (`pi@192.168.0.217`):
```bash
cd /home/pi/fazendinha_online
git reset --hard HEAD
git pull origin main
```

## 2. Atualizar o Backend
```bash
cd /home/pi/fazendinha_online/server
npm install
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
```

## 3. Configuração do Nginx (Domínio sgiptv.com.br)
Certifique-se de que o arquivo `/etc/nginx/sites-available/default` (ou o arquivo correspondente ao seu site principal) contém as rotas para a Fazendinha:

```nginx
server {
    listen 80;
    server_name sgiptv.com.br;

    # Site Principal (SG IPTV)
    location / {
        root /home/pi/sgiptv-frontend;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Jogo Fazendinha (Acesso via sgiptv.com.br/fazendinha)
    location = /fazendinha {
        return 301 /fazendinha/;
    }

    location /fazendinha/ {
        alias /home/pi/fazendinha_online/;
        index index.html;
        # Segurança
        location ~ ^/fazendinha/(server|migrations|\.git) { deny all; }
    }

    # API do Jogo
    location /fazendinha/api/ {
        proxy_pass http://localhost:3002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Após editar, valide e reinicie o Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 4. Cloudflare
Como você está usando o domínio `sgiptv.com.br` no Cloudflare, certifique-se de que o tráfego está sendo encaminhado para o IP local do Raspberry Pi (ou via Cloudflare Tunnel configurado para a porta 80). O Nginx cuidará do roteamento interno baseado no subcaminho `/fazendinha`.

## 5. Resumo das Mudanças Visuais (v1.0.3)
- **Remoção da Terra Redundante:** O jogo agora usa apenas os assets `slot_planta_v5.png` e `slot_vazio_v5.png`, eliminando quadrados de terra gerados por código.
- **Botões Inteligentes:** O botão "Usar" agora vira "Coletar" automaticamente quando a planta está pronta. O botão "Remover" só aparece quando há algo no slot.
- **Missões Iniciais:** Novos usuários agora recebem 5 missões automaticamente.
- **Estabilização:** Refatoração de rotas para evitar duplicidade no painel admin.
