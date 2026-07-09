# Fazendinha Online v5.0.1

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
- `index.html`: Frontend Principal (v5.0.1).
- `server/`: Backend em Node.js com Express e PostgreSQL.
- `assets/`: Recursos visuais (Padrão Praia/PvU).
- `migrations/`: Scripts de atualização do Banco de Dados.

## Novidades v5.0.1
- Consolidação de segurança e autenticação.
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
- Sincronização final de versões (v5.0.1).
======
- Sincronização final de versões (v3.0.1).
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
======
cd /home/pi/fazendinha_online && ./deploy.sh
>>>>>> main
>>>>>> main
>>>>>> main
