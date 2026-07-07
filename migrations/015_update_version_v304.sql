-- Migração 015: Atualização de Versão para v3.0.4
UPDATE fazenda_config SET valor = '3.0.4' WHERE chave = 'version' OR chave = 'game_version';
INSERT INTO fazenda_config (chave, valor) VALUES ('version', '3.0.4'), ('game_version', '3.0.4') ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
