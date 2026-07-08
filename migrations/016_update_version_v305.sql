-- Migration 016: Update version to v3.0.5
UPDATE fazenda_config SET valor = '3.0.5' WHERE chave = 'version';
INSERT INTO fazenda_config (chave, valor) VALUES ('version', '3.0.5') ON CONFLICT (chave) DO UPDATE SET valor = '3.0.5';
