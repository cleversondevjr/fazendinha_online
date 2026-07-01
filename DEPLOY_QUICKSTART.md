# Guia Rápido de Deploy - Fazendinha Online v1.1.0

Siga estes passos exatos no seu Raspberry Pi para colocar o jogo online no domínio `sgiptv.com.br/fazendinha`.

## 1. Atualizar o Código
No terminal do Raspberry Pi:
```bash
cd /home/pi/fazendinha_online
git pull origin main
```

## 2. Configurar o Banco de Dados (PostgreSQL)
Certifique-se de que o banco `farm` existe e o usuário `pi` tem acesso.
```bash
# Executar as migrações principais e correções
psql -h localhost -U pi -d farm -f migrations/full_deploy.sql
psql -h localhost -U pi -d farm -f migrations/007_fix_users_table.sql
```

## 3. Configurar e Iniciar o Backend
```bash
cd /home/pi/fazendinha_online/server
npm install
# Iniciar ou Reiniciar com PM2
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
pm2 save
```

## 4. Configurar o Nginx
Use o conteúdo do arquivo `nginx.conf.final` no seu arquivo de configuração do Nginx (geralmente em `/etc/nginx/sites-available/default`).

Após editar, valide e reinicie:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Verificação
Execute o script de diagnóstico para confirmar se está tudo certo:
```bash
cd /home/pi/fazendinha_online
python3 diagnostico.py
```

## 6. Acesso
O jogo estará disponível em:
**https://sgiptv.com.br/fazendinha**

---
**Nota sobre Login:**
Se encontrar erro de conexão no login, limpe o cache do seu navegador (Ctrl+F5) ou teste em uma aba anônima. O sistema agora usa cookies seguros otimizados para o Cloudflare.
