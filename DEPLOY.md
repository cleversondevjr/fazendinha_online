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
Copie o conteúdo de `nginx.conf.example` para o seu arquivo de sites ativos do Nginx (geralmente em `/etc/nginx/sites-available/default` ou um arquivo novo em `sites-enabled`).

Lembre-se de ajustar o caminho no `alias` para o local onde você clonou o repositório:
`alias /home/pi/fazendinha_online;`

Reinicie o Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Iniciando o Servidor
Recomendamos o uso do `pm2` para gerenciar o processo:
```bash
sudo npm install -g pm2
cd server
# Certifique-se de que o .env está configurado com PGDATABASE=farm e PORT=3002
pm2 start index.js --name "fazendinha-backend"
pm2 save
pm2 startup
```

## 6. Cloudflare (Túnel Local)
O seu túnel é gerenciado localmente no Raspberry Pi.

**ID do Túnel:** `5f23e228-85d8-4a42-ab7c-ef4f70a65722`

No painel de DNS do Cloudflare, adicione um registro:
- **Tipo:** CNAME
- **Nome:** @
- **Alvo:** `5f23e228-85d8-4a42-ab7c-ef4f70a65722.cfargotunnel.com`
- **Proxy:** Ativado (Nuvem Laranja)

### Configuração do Túnel (/etc/cloudflared/config.yml)
```yaml
tunnel: 5f23e228-85d8-4a42-ab7c-ef4f70a65722
credentials-file: /home/pi/.cloudflared/5f23e228-85d8-4a42-ab7c-ef4f70a65722.json

ingress:
  - hostname: sgiptv.com.br
    service: http://127.0.0.1:80
  - hostname: copa.sgiptv.com.br
    service: http://127.0.0.1:80
  - hostname: api.sgiptv.com.br
    service: http://127.0.0.1:10000
  - hostname: farm.sgiptv.com.br
    service: http://127.0.0.1:3002
  - service: http_status:404
```
