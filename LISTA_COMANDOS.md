# Guia de Deploy Rápido - Fazendinha Online

Siga estes comandos na sequência para atualizar o seu servidor Raspberry Pi com a versão mais recente do GitHub.

### 1. Acesso ao Servidor
```bash
ssh pi@192.168.0.217
```

### 2. Atualização de Código (Git)
Navegue até a pasta e force a atualização para ignorar mudanças locais:
```bash
cd /home/pi/fazendinha_online
git fetch origin
git reset --hard origin/main
```

### 3. Atualização do Banco de Dados (PostgreSQL)
Execute as migrações para garantir que as tabelas de usuários e sessões existam:
```bash
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql
psql -h localhost -U pi -d farm -f migrations/007_fix_users_table.sql
```
*Nota: Se pedir senha, use a senha do banco de dados.*

### 4. Backend e Dependências (PM2)
Instale novos pacotes (como o sistema de login) e reinicie o servidor:
```bash
cd /home/pi/fazendinha_online/server
npm install
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
```

### 5. Proxy Reverso (Nginx)
Reinicie o Nginx para garantir que as rotas `/fazendinha` estejam ativas:
```bash
sudo systemctl restart nginx
```

---
**Dica de Ouro:** Se após o deploy as imagens ou o site parecerem antigos, limpe o cache do seu navegador usando **Ctrl + F5** na página do jogo.

**Link do Jogo:** [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
