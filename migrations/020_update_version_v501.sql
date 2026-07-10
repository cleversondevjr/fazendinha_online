-- Migração 020: Atualiza a versão do jogo para v5.0.1
UPDATE fazenda_config SET valor = 'v5.0.1' WHERE chave = 'game_version';
UPDATE fazenda_config SET valor = 'v5.0.1' WHERE chave = 'version';

-- Garante que o registro exista se não houver
INSERT INTO fazenda_config (chave, valor)
VALUES ('game_version', 'v5.0.1')
ON CONFLICT (chave) DO UPDATE SET valor = 'v5.0.1';

INSERT INTO fazenda_config (chave, valor)
VALUES ('version', 'v5.0.1')
ON CONFLICT (chave) DO UPDATE SET valor = 'v5.0.1';
