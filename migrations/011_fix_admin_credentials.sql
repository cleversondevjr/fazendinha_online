-- Migration para garantir as credenciais do admin CleversonS
INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
VALUES (1, 'CleversonS', 'cleverson@sgiptv.com.br', 'Wincster@194060le', TRUE)
ON CONFLICT (id) DO UPDATE
SET login = 'CleversonS', senha = 'Wincster@194060le', is_admin = TRUE;
