-- Migração 014: Atualização de Versão para v3.0.3
UPDATE fazenda_config SET valor = '3.0.3' WHERE chave = 'version' OR chave = 'game_version';
INSERT INTO fazenda_config (chave, valor) VALUES ('version', '3.0.3'), ('game_version', '3.0.3') ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
