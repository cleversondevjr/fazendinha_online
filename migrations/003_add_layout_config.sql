-- Add active_layout config
INSERT INTO fazenda_config (chave, valor, descricao) VALUES
('active_layout', 'default', 'Layout ativo do jogo (default, immersive, retro, neon)')
ON CONFLICT (chave) DO NOTHING;
