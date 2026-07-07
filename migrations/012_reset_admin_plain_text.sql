-- Migração 012: Reset administrativo e senhas em texto simples
-- Garante que o administrador CleversonS exista e tenha permissões.

INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (1, 'CleversonS', 'cleversonsantos@gmail.com', 'Wincster@194060le', true)
ON CONFLICT (id) DO UPDATE SET senha = EXCLUDED.senha, is_admin = true;

SELECT setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));

CREATE TABLE IF NOT EXISTS fazenda_admin_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INT,
    acao TEXT NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO fazenda_admin_logs (usuario_id, acao, detalhes)
VALUES (1, 'SYSTEM_RESET', '{"versao": "3.0.4", "motivo": "Consolidação v3.0.4 e plain-text"}');
