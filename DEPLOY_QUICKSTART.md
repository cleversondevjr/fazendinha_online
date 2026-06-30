# Comandos Rápidos de Deploy - Fazendinha Online

Execute estes comandos no terminal do seu Raspberry Pi para subir a versão v1.0.4.

### 1. Atualizar Código
```bash
cd /home/pi/fazendinha_online
git reset --hard HEAD
git pull origin main
```

### 2. Configurar Banco de Dados
```bash
# Executar a migração consolidada para garantir que todas as tabelas e dados iniciais existam
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql
```

### 3. Reiniciar Backend com PM2
```bash
cd server
npm install
# Garanta que o .env está com PORT=3002, PGDATABASE=farm e ADMIN_USER_ID=1 (ou seu ID)
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
```

### 4. Recarregar Nginx
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### 5. Verificar Online
Acesse: [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
*(Dica: Use aba anônima se não vir as mudanças de layout de imediato devido ao cache do navegador).*
