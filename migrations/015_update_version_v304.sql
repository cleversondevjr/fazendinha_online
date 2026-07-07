-- Migration para atualizar a versão do jogo para 3.0.4
UPDATE fazenda_config SET valor = 'v3.0.4' WHERE chave = 'game_version';
