# Fazendinha Online v3.0.4

Projeto baseado na economia do PvU 2021, adaptado para ser jogado online via Raspberry Pi 3.

## Acesso
- **Domínio:** [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
- **Infraestrutura:** Servidor local no Raspberry Pi 3 acessível via SSH e túnel Cloudflare.

## Automação de Deploy
O projeto está configurado com **Auto-Merge** e **Webhook**.
- Ao fazer o `submit` das alterações, o GitHub realiza o merge automático para a branch `main`.
- O Webhook sinaliza o Raspberry Pi, que executa o script `./deploy.sh`.

## Como Atualizar Manualmente (se necessário)
```bash
cd /home/pi/fazendinha_online && ./deploy.sh
```

## Estrutura do Projeto
- `index.html`: Frontend Principal (v3.0.4).
- `server/`: Backend em Node.js com Express e PostgreSQL.
- `assets/`: Recursos visuais (Padrão Praia/PvU).
- `migrations/`: Scripts de atualização do Banco de Dados.

## Novidades v3.0.4
- Integração com Painel SGIPTV via parâmetro `?admin=true`.
- Login Restrito por padrão com desbloqueio dinâmico.
- Autenticação por texto simples (Plain-text) conforme solicitado.
- Hardening de segurança no servidor Express.
- Cache-busting automático para assets CSS/JS.
