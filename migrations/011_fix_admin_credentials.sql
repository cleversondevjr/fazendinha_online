-- Migração 011: Correção de Credenciais Administrativas
-- Garante que o login do CleversonS e do admin padrão funcionem com as senhas corretas

-- Senha CleversonS: Wincster@194060le
UPDATE fazenda_usuarios
SET senha = '$2b$10$3KeeHPBR2/1ANFqBbbFT0ukF1ITSZWsx9Lu/mL5YnFByVwrpS1R6S',
    is_admin = TRUE,
    email = 'cleverson@sgiptv.com.br'
WHERE login = 'CleversonS';

-- Senha admin: fazenda123
UPDATE fazenda_usuarios
SET senha = '$2b$10$LYVsI04zHR5PhYFU3oAlEO/WySH8/dmC7kL5SyewJVrqGfm6h2Idu',
    is_admin = TRUE,
    email = 'admin@sgiptv.com.br'
WHERE login = 'admin';

-- Garante que o ID 1 seja do CleversonS (se não for, a migração 008 já deve ter cuidado, mas reforçamos)
-- Garante que o ID 1 seja do CleversonS de forma segura
DO $$
BEGIN
    -- Se o login existe, tentamos garantir o ID 1
    IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS') THEN
        -- Se o ID 1 já estiver ocupado por outro login, movemos o outro para o próximo ID disponível
        IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE id = 1 AND login != 'CleversonS') THEN
            UPDATE fazenda_usuarios SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM fazenda_usuarios) WHERE id = 1;
        END IF;

        UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';
        -- Sincroniza a sequência
        PERFORM setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));
    END IF;
END $$;
