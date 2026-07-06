-- Migration para atualizar a versão do jogo para 3.0.1
UPDATE fazenda_config SET valor = 'v3.0.1' WHERE chave = 'game_version';
