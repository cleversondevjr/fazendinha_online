-- Migration para atualizar a versão do jogo para 3.0.3
UPDATE fazenda_config SET valor = 'v3.0.3' WHERE chave = 'game_version';
