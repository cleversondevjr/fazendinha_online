-- Migração 013: Versão v3.0.2
UPDATE fazenda_config SET valor = '3.0.2' WHERE chave = 'version' OR chave = 'game_version';
INSERT INTO fazenda_config (chave, valor) VALUES ('version', '3.0.2'), ('game_version', '3.0.2') ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
