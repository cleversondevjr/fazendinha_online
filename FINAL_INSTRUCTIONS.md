# Guia Rápido: Colocando o Site Online

Para colocar a Fazendinha online no seu Raspberry Pi sob o domínio principal, siga estes passos:

### 1. Atualizar o Código no Servidor
No seu Raspberry Pi, execute:
```bash
cd /home/pi/fazendinha_online
git pull origin deploy-fazendinha-v1
```

### 2. Configurar o Nginx
Você deve adicionar as rotas da fazendinha **dentro** do bloco `server` que já cuida do domínio `sgiptv.com.br`.

**Comando:**
```bash
sudo nano /etc/nginx/sites-available/default
```

**Adicione estas linhas antes do último `}` do bloco server:**
```nginx
    # Rotas da Fazendinha
    location = /fazendinha {
        return 301 /fazendinha/;
    }

    location /fazendinha/ {
        alias /home/pi/fazendinha_online/;
        index index.html;
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

**Reinicie o Nginx:**
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### 3. Reiniciar o Backend
```bash
cd /home/pi/fazendinha_online/server
npm install
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
```

### 4. Acesso Oficial
O novo endereço oficial é:
[https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)

---
**Nota:** O sistema foi testado e validado. Certifique-se de que o seu `.env` em `server/` aponta para o banco de dados correto.
