-- Migração 012: Reset completo de usuários e estabelecimento de credenciais administrativas em texto simples
-- CUIDADO: Esta migração limpa a tabela de usuários (conforme solicitado para reset de ambiente)

-- Limpa a tabela e insere o admin principal
TRUNCATE TABLE fazenda_usuarios CASCADE;

INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (1, 'CleversonS', 'cleversonsantos@gmail.com', 'Wincster@194060le', true);

-- Sincroniza a sequência
SELECT setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));

-- Registra o log administrativo do reset
CREATE TABLE IF NOT EXISTS fazenda_admin_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INT,
    acao TEXT NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO fazenda_admin_logs (usuario_id, acao, detalhes)
VALUES (1, 'SYSTEM_RESET', '{"versao": "3.0.5", "motivo": "Alinhamento de credenciais plain-text e seguranca"}');