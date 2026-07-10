UPDATE fazenda_usuarios
SET senha = 'Wincster@194060le', is_admin = TRUE
WHERE login = 'CleversonS' OR id = 1;

INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (1, 'CleversonS', 'cleversonleite2014@gmail.com', 'Wincster@194060le', TRUE)
ON CONFLICT (id) DO UPDATE SET senha = 'Wincster@194060le', is_admin = TRUE;



INSERT INTO fazenda_admin_logs (admin_id, acao, detalhes)
VALUES (1, 'SYSTEM_RESET', '{"versao": "5.0.1", "motivo": "Alinhamento de credenciais plain-text"}');