-- Migration 015: Update version to v3.0.4
UPDATE fazenda_config SET valor = '3.0.4' WHERE chave = 'version';
INSERT INTO fazenda_config (chave, valor) VALUES ('version', '3.0.4') ON CONFLICT (chave) DO UPDATE SET valor = '3.0.4';
