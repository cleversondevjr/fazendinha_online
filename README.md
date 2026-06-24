# farm2.0 - Instruções de Deploy e Manutenção (Raspberry Pi)

Este guia contém os comandos exatos para configurar e manter o seu servidor de jogo.

## 1. Configuração Inicial (Primeira vez)

Acesse seu Raspberry Pi via SSH e siga estes passos:

### Instalar dependências do sistema
```bash
sudo apt update
sudo apt install nodejs npm postgresql
```

### Configurar o Banco de Dados (PostgreSQL)
```bash
# Crie o banco de dados
sudo -u postgres createdb farm

# Execute as migrações (na raiz do projeto)
psql -h localhost -U postgres -d farm -f migrations/001_initial_schema.sql
psql -h localhost -U postgres -d farm -f migrations/002_seed_data.sql
```

### Configurar o Backend
```bash
cd server
npm install
cp .env.example .env
# Edite o .env com suas credenciais do Postgres
nano .env
```

---

## 2. Comandos de Manutenção Diária

### Iniciar o Servidor (Background)
Para garantir que o jogo continue online após fechar o SSH:
```bash
cd server
nohup node index.js > server.log 2>&1 &
```

### Ver Logs do Servidor
```bash
tail -f server/server.log
```

### Parar o Servidor
```bash
kill $(lsof -t -i :3000)
```

---

## 3. Estrutura do Projeto
- `/server`: Lógica da API e Cronjobs (Porta 3000).
- `/migrations`: Scripts SQL para atualização do banco.
- `/assets`: Imagens e animações.
- `index.html`, `script.js`: Frontend do jogo.

---

## 4. Notas Importantes
- **Crows/Pests:** São processados automaticamente pelo servidor a cada minuto.
- **Missões:** Rotacionam a cada 4 horas automaticamente.
- **Backup:** Recomenda-se fazer backup do banco de dados periodicamente:
  `pg_dump -U postgres farm2 > backup_farm.sql`
