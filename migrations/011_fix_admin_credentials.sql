-- Migração 011: Garante que o usuário administrativo 'CleversonS' possua o ID 1
DO $$
BEGIN
    -- Se o usuário existir mas com ID diferente de 1, tenta ajustar
    IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS' AND id <> 1) THEN
        -- Tenta liberar o ID 1 se estiver ocupado
        UPDATE fazenda_usuarios SET id = 9999 WHERE id = 1;
        UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';
    END IF;

    -- Se não existir, cria
    IF NOT EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS') THEN
        -- Garante que o ID 1 esteja vago
        DELETE FROM fazenda_usuarios WHERE id = 1;
        INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
        VALUES (1, 'CleversonS', 'cleversonsantos@gmail.com', 'Wincster@194060le', true);
    END IF;

    -- Sincroniza a sequência de IDs para evitar conflitos futuros
    PERFORM setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));
END $$;
