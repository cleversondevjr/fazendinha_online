# Guia de Deploy - Fazendinha Online

Este documento descreve os passos para colocar o projeto online no Raspberry Pi.

## 1. Requisitos
- Node.js (v14+)
- PostgreSQL
- Nginx
- Domínio configurado no Cloudflare (sgiptv.com.br)

## 2. Preparação do Banco de Dados
Acesse o terminal do Raspberry Pi:
```bash
sudo -u postgres psql
```
No console do Postgres:
```sql
CREATE DATABASE farm;
CREATE USER pi WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE farm TO pi;
\q
```

Execute as migrações:
```bash
psql -h localhost -U pi -d farm -f migrations/001_initial_schema.sql
psql -h localhost -U pi -d farm -f migrations/002_seed_data.sql
```

## 3. Configuração do Backend
```bash
# Garantir permissões corretas
sudo chown -R pi:pi /home/pi/fazendinha_online
git config --global --add safe.directory /home/pi/fazendinha_online

cd server
npm install
cp .env.example .env
```
Edite o `.env` com as credenciais do banco e a porta desejada. (Neste projeto usamos a porta **3002** pois a 3000 já estava em uso).

## 4. Configuração do Nginx
Adicione o bloco abaixo dentro do seu arquivo de configuração do site `sgiptv.com.br` (geralmente em `/etc/nginx/sites-available/default`):

```nginx
    # Rotas da Fazendinha
    location = /fazendinha {
        return 301 /fazendinha/;
    }

    location /fazendinha/ {
        alias /home/pi/fazendinha_online/;
        index index.html;

        # Segurança: Bloqueia acesso direto a pastas sensíveis
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

Reinicie o Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Iniciando o Servidor
Certifique-se de que o `.env` no diretório `server` tem a porta `3002` e o `PGDATABASE=farm`.

```bash
cd /home/pi/fazendinha_online/server
npm install
pm2 start index.js --name "fazendinha-backend"
pm2 save
```

## 6. Cloudflare (Túnel Local)
O acesso externo é feito via Túnel do Cloudflare. Como configuramos o Nginx para responder em `sgiptv.com.br/fazendinha`, o túnel só precisa encaminhar o tráfego do domínio principal para a porta 80 do Nginx.

**Configuração recomendada do Túnel (/etc/cloudflared/config.yml):**
```yaml
tunnel: 5f23e228-85d8-4a42-ab7c-ef4f70a65722
credentials-file: /home/pi/.cloudflared/5f23e228-85d8-4a42-ab7c-ef4f70a65722.json

ingress:
  - hostname: sgiptv.com.br
    service: http://127.0.0.1:80
  - hostname: copa.sgiptv.com.br
    service: http://127.0.0.1:80
  - service: http_status:404
```
*(O hostname `farm.sgiptv.com.br` não é mais necessário para este projeto, pois agora usamos o subcaminho `/fazendinha` no domínio principal).*
