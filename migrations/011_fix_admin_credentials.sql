-- Migração 011: Correção de Credenciais Administrativas
-- Garante que o login do CleversonS e do admin padrão funcionem com as senhas corretas

-- Senha CleversonS: Wincster@194060le
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('CleversonS', '$2b$10$/yGVsJkzI72VN6HC.k.zHuq70kNKFqNcPkbWzmCNgJ.ajKkyx2SEK', 'cleverson@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    senha = EXCLUDED.senha,
    is_admin = TRUE,
    email = EXCLUDED.email;

-- Garante também o login 'cleversonle' (comum no Raspberry)
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('cleversonle', '$2b$10$/yGVsJkzI72VN6HC.k.zHuq70kNKFqNcPkbWzmCNgJ.ajKkyx2SEK', 'cleversonle@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    senha = EXCLUDED.senha,
    is_admin = TRUE;

-- Senha admin: fazenda123
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('admin', '$2b$10$1ao0Fsz4Ajlrfkh4q0mNBuZKd96WNM805EVsk1TdtWVoyMBGnCec.', 'admin@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    senha = EXCLUDED.senha,
    is_admin = TRUE,
    email = EXCLUDED.email;

-- Garante que o ID 1 seja do CleversonS de forma segura
DO $$
BEGIN
    -- Se o login existe, tentamos garantir o ID 1
    IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS') THEN
        -- Se o ID 1 já estiver ocupado por outro login, movemos o outro para o próximo ID disponível
        IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE id = 1 AND login != 'CleversonS') THEN
            UPDATE fazenda_usuarios SET id = (SELECT COALESCE(MAX(id), 0) + 2 FROM fazenda_usuarios) WHERE id = 1;
        END IF;

        UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';
        -- Sincroniza a sequência
        PERFORM setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));
    END IF;
END $$;
