-- Migração 012: Reset total de usuários e configuração de Admin único em texto simples
-- Remove todos os usuários existentes e recria apenas o CleversonS solicitado

DELETE FROM fazenda_usuarios;

INSERT INTO fazenda_usuarios (id, login, senha, email, is_admin)
VALUES (1, 'CleversonS', 'Wincster@194060le', 'cleverson@sgiptv.com.br', TRUE);

-- Sincroniza a sequência do ID para evitar conflitos em novos cadastros
SELECT setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));
