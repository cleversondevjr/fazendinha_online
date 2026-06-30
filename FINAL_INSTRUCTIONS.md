# Instruções Finais de Deploy - Fazendinha Online (v1.0.4)

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
O arquivo `/etc/nginx/sites-available/default` deve conter as rotas para a Fazendinha. Note o uso de `alias` para o subcaminho `/fazendinha/`:

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
        # Segurança: Bloquear acesso a pastas sensíveis
        location ~ ^/fazendinha/(server|migrations|\.git|\.env) { deny all; }
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

## 4. Banco de Dados
Certifique-se de que o PostgreSQL está rodando e execute o script de migração total se ainda não o fez:
```bash
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql
```

## 5. Resumo das Mudanças (v1.0.4)
- **Subcaminho `/fazendinha/`:** Compatibilidade total com o domínio sgiptv.com.br/fazendinha.
- **Painel Admin:** Gerenciamento completo de usuários, itens, missões e regras de jogo diretamente pelo navegador.
- **Lógica de Crescimento:** As plantas agora param de crescer se o vaso expirar ou se faltar água, retomando após o uso do item.
- **Interface Otimizada:** Botões dinâmicos (Colher/Usar) e remoção de elementos visuais redundantes.
- **Versioning:** Cache busting implementado para garantir que as novas versões do CSS/JS sejam carregadas.
