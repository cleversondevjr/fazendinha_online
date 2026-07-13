# Fazendinha Online - Jogo de Fazenda Multiplayer

## 🌾 Descrição

Fazendinha Online é um jogo web de fazenda em tempo real com elementos de RPG, onde jogadores cultivam plantas, completam missões e colaboram em uma árvore mundial.

## 🚀 Tecnologias

- **Backend:** Node.js + Express
- **Banco de Dados:** PostgreSQL
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla
- **Autenticação:** BCrypt + Sessions
- **Deploy:** Automático via GitHub Webhooks


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
- Admin enforcement (apenas Admin tem acesso)
- Validação de sessão
- Proteção contra SQL Injection
- CORS configurado

### Painéis Admin:
- Gerenciar Recursos de Jogadores
- Gerenciar Slots
- Parâmetros de Flores/Árvores
- Itens de Consumo
- Modelos de Missões
- Configurações Globais
- Roadmap (Feature Flags)
- Logs de Auditoria

## 🔄 Deploy Automático Via Python

Webhook GitHub: `https://sgiptv.com.br/api/webhook/github`

Quando há push em `main`, o servidor executa automaticamente:

& 'C:\Users\Cleverson\AppData\Local\Programs\Python\Python312\python.exe' deploy.py "feat: automacao unificada finalizada com sucesso"

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

**Versão:** v5.0.2  
**Última Atualização:** 13 de Julho 2026  
**Status:** ✅ Em Produção
# Webhook Testado sex 10 jul 2026 02:44:24 -03
# Teste de webhook - sex 10 jul 2026 02:58:53 -03
