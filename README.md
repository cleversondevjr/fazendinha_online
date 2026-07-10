# Fazendinha Online - Jogo de Fazenda Multiplayer

## 🌾 Descrição

Fazendinha Online é um jogo web de fazenda em tempo real com elementos de RPG, onde jogadores cultivam plantas, completam missões e colaboram em uma árvore mundial.

## 🚀 Tecnologias

- **Backend:** Node.js + Express
- **Banco de Dados:** PostgreSQL
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla
- **Autenticação:** BCrypt + Sessions
- **Deploy:** Automático via GitHub Webhooks

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/cleversondevjr/fazendinha_online.git
cd fazendinha_online

# Instale dependências
npm install

# Configure .env
cp .env.example .env

# Inicie o servidor
node server/index.js
```

## 🎮 Funcionalidades

- ✅ Sistema de cultivo com múltiplos estágios
- ✅ Missões diárias com rotação automática
- ✅ Passe de Temporada com recompensas
- ✅ Árvore Mundial colaborativa
- ✅ Marketplace de itens
- ✅ Painel Admin completo
- ✅ Sistema de clima dinâmico
- ✅ Eventos aleatórios (corvos, pragas)

## 🔐 Segurança

- Senhas com BCrypt (10 rounds)
- Admin enforcement (apenas CleversonS tem acesso)
- Validação de sessão
- Proteção contra SQL Injection
- CORS configurado

## 📊 Admin

**Login:** `CleversonS`
**Senha:** `Wincster@194060le`

### Painéis Admin:
- Gerenciar Recursos de Jogadores
- Gerenciar Slots
- Parâmetros de Flores/Árvores
- Itens de Consumo
- Modelos de Missões
- Configurações Globais
- Roadmap (Feature Flags)
- Logs de Auditoria

## 🔄 Deploy Automático

Webhook GitHub: `https://sgiptv.com.br/api/webhook/github`

Quando há push em `main`, o servidor executa automaticamente:
```bash
./deploy.sh
```

## 📁 Estrutura

```
.
├── server/
│   ├── index.js           # App principal
│   ├── db.js             # Pool PostgreSQL
│   ├── cron.js           # Tarefas agendadas
│   ├── routes/
│   │   ├── auth.js       # Autenticação
│   │   ├── game.js       # Lógica do jogo
│   │   ├── admin.js      # Painel admin
│   │   └── webhook.js    # Deploy automático
│   └── utils/
│       ├── player_init.js    # Inicialização
│       └── feature_check.js  # Feature flags
├── script.js             # Frontend principal
├── index.html            # Página do jogo
├── login.html            # Página de login
└── deploy.sh             # Script de deploy
```

## 📝 Variáveis de Ambiente

```env
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://user:password@localhost/fazendinha_online
SESSION_SECRET=sua-chave-secreta
GITHUB_WEBHOOK_SECRET=seu-secret-opcional
```

## 🐛 Debugging

```bash
# Ver logs do servidor
pm2 logs fazendinha-backend

# Ver logs de deploy
tail -f /home/pi/fazendinha_online/deploy.log

# Ver status do PM2
pm2 list
```

## 📞 Suporte

Para reportar bugs ou sugestões, abra uma issue no GitHub.

---

**Versão:** v5.0.1  
**Última Atualização:** Julho 2026  
**Status:** ✅ Em Produção
# Webhook Testado sex 10 jul 2026 02:44:24 -03
# Teste de webhook - sex 10 jul 2026 02:58:53 -03
