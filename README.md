# Fazendinha Online v3.0.6

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
cd /home/pi/fazendinha_online && ./deploy.sh