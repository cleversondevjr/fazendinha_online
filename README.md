# Fazendinha Online v1.2.0

Projeto baseado na economia do PvU 2021, adaptado para ser jogado online via Raspberry Pi.

## Como Atualizar o Servidor

Para realizar a atualização completa do sistema (Frontend, Assets, Banco de Dados e Backend), execute o seguinte comando no terminal do seu Raspberry Pi:

```bash
cd /home/pi/fazendinha_online && ./deploy.sh
```

**Este é o único comando necessário.** Ele irá:
1. Sincronizar o código com o GitHub.
2. Atualizar as tabelas do Banco de Dados.
3. Reiniciar o servidor Backend (PM2).
4. Reiniciar o Servidor Web (Nginx).

## Estrutura
- `index.html`: Frontend Principal.
- `server/`: Backend em Node.js (API).
- `assets/`: Imagens e sons do jogo.
- `migrations/`: Scripts de banco de dados.

## Suporte
Acesse através de: [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
