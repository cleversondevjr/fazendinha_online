UPDATE fazenda_usuarios
SET senha = 'Wincster@194060le', is_admin = TRUE
WHERE login = 'CleversonS' OR id = 1;

INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (1, 'CleversonS', 'cleversonS@exemplo.com', 'Wincster@194060le', TRUE)
ON CONFLICT (id) DO UPDATE SET senha = 'Wincster@194060le', is_admin = TRUE;

INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (2, 'admin', 'admin@fazendinha.com', 'fazenda123', TRUE)
ON CONFLICT (id) DO UPDATE SET senha = 'fazenda123', is_admin = TRUE;

<<<<<< feature/v3.0.1-final-sync-14719019057366838169
INSERT INTO fazenda_admin_logs (admin_id, acao, detalhes)
VALUES (1, 'SYSTEM_RESET', '{"versao": "5.0.1", "motivo": "Alinhamento de credenciais plain-text"}');
=======
INSERT INTO fazenda_admin_logs (usuario_id, acao, detalhes)
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
VALUES (1, 'SYSTEM_RESET', '{"versao": "3.0.1", "motivo": "Alinhamento de credenciais plain-text e seguranca"}');
======
VALUES (1, 'SYSTEM_RESET', '{"versao": "3.0.5", "motivo": "Alinhamento de credenciais plain-text e seguranca"}');
>>>>>> main
>>>>>> main
