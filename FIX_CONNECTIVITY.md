# Ajuste Fino de Conectividade e Login

O site principal estava sendo redirecionado porque a configuração anterior do Nginx estava tentando gerenciar o domínio inteiro. Vamos corrigir isso inserindo apenas as rotas da Fazendinha.

### 1. Corrigir o Nginx (IMPORTANTE)
Não substitua o seu arquivo inteiro. Adicione estes blocos **dentro** do `server { ... }` que você já tem para o domínio `sgiptv.com.br`:

```nginx
    # Rotas da Fazendinha (Adicione isso ao final do seu server block)
    location = /fazendinha {
        return 301 /fazendinha/;
    }

    location /fazendinha/ {
        alias /home/pi/fazendinha_online/;
        index index.html;

        # Bloqueio de segurança
        location ~ ^/fazendinha/(server|migrations|\.git) { deny all; }
    }

    location /fazendinha/api/ {
        proxy_pass http://localhost:3002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
```

**Comando para reiniciar:**
```bash
sudo systemctl restart nginx
```

### 2. Atualizar o Backend
Rode estes comandos para que o sistema de login passe a funcionar:

```bash
cd /home/pi/fazendinha_online
git pull origin deploy-fazendinha-v1
cd server
npm install
pm2 restart fazendinha-backend
```

### 3. Login
Agora, se você não estiver logado, o site vai te levar automaticamente para:
`https://farm.sgiptv.com.br/farm/login?next=%2Ffarm%2F`
