# Resumo do Projeto: Fazendinha Online v5.0.1

Este documento serve como guia para a continuidade do desenvolvimento do projeto.

## Estado Atual (v5.0.1)
- **Versão:** 5.0.1 (Sincronizada em `package.json`, `index.html`, `login.html`, `README.md`, `deploy.sh` e banco de dados).
- **Segurança:** Autenticação restaurada com **bcryptjs**. As senhas no banco de dados estão hasheadas.
- **Admin:** Painel Admin funcional e protegido. O botão "Admin" no frontend só aparece para usuários com `is_admin = true`.
- **Economia:** Backend totalmente compatível com **BigInt** para Ouro e Diamantes.
- **Lógica de Jogo:**
    - Rega: 2h por gota, limites de 4h/8h.
    - Colheita/Remoção: Preserva o estado do vaso e da água se ainda forem válidos.
- **Infra:** Rodando em Raspberry Pi 3 via PM2 e Nginx no subdiretório `/fazendinha/`.

## Banco de Dados
- Migração consolidada em `migrations/v501_consolidated.sql`.
- Tabelas principais: `fazenda_usuarios`, `fazenda_plantacoes`, `fazenda_inventario`, `fazenda_features`, `fazenda_missoes_jogador`.

## Próximos Passos
1. **Frontend do Marketplace:** Implementar a visualização de itens à venda e a interface de listagem.
2. **Season Pass UI:** Finalizar a visualização dos 30 níveis e o botão de resgate de recompensas.
3. **Check-in Diário:** Validar visualmente a entrega de recompensas.
4. **Assets:** Verificar se todos os `.png` referenciados nas tabelas de configuração existem na pasta `assets/`.
5. **Painel Admin:** Testar a edição em tempo real de preços e tempos de crescimento.

---
*Gerado por Jules em 09/07/2026*
