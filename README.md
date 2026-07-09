# Fazendinha Online v4.0.0

[cite_start]Projeto baseado na economia do PvU 2021, adaptado para ser jogado online via Raspberry Pi 3[cite: 1].

## Acesso
- [cite_start]**Domínio:** [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/) [cite: 1]
- [cite_start]**Infraestrutura:** Servidor local no Raspberry Pi 3 acessível via SSH e túnel Cloudflare[cite: 1].

## Automação de Deploy
[cite_start]O projeto está configurado com **Auto-Merge** e **Webhook**[cite: 2].
- [cite_start]Ao fazer o `submit` das alterações, o GitHub realiza o merge automático para a branch `main`[cite: 3].
- [cite_start]O Webhook sinaliza o Raspberry Pi, que executa o script `./deploy.sh`[cite: 4].

## Como Atualizar Manualmente (se necessário)
```bash
<<<<<< v5.0.1
cd /home/pi/fazendinha_online && ./deploy.sh
```

## Estrutura do Projeto
- `index.html`: Frontend Principal (v3.0.1).
- `server/`: Backend em Node.js com Express e PostgreSQL.
- `assets/`: Recursos visuais (Padrão Praia/PvU).
- `migrations/`: Scripts de atualização do Banco de Dados.

## Novidades v3.0.1
- Consolidação de segurança e autenticação.
- Sincronização final de versões (v3.0.1).
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
=======
=======
cd /home/pi/fazendinha_online && ./deploy.sh
>>>>>> main
>>>>>> main
