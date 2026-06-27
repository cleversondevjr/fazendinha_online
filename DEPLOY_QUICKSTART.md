# Comandos Rápidos de Deploy - Fazendinha Online

Execute estes comandos no terminal do seu Raspberry Pi para subir a versão v1.0.3.

### 1. Atualizar Código
```bash
cd /home/pi/fazendinha_online
git pull origin main
```

### 2. Configurar Banco de Dados
```bash
# Executar as migrações (se ainda não executou a 003)
psql -h localhost -U pi -d farm -f migrations/003_add_layout_config.sql
```

### 3. Reiniciar Backend com PM2
```bash
cd server
npm install
# Garanta que o .env está com PORT=3002 e PGDATABASE=farm
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
```

### 4. Recarregar Nginx
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### 5. Verificar Online
Acesse: [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
*(Dica: Use aba anônima se não vir as mudanças de layout de imediato).*
