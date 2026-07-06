-- Migração 011: Correção de Credenciais Administrativas
-- Garante que o login do CleversonS e do admin padrão funcionem com as senhas corretas

-- Atualiza CleversonS (Senha: Wincster@194060le)
UPDATE fazenda_usuarios
SET senha = '$2b$10$vsAacXh//CO1RR0ogxhoU.29/oTlnO7XJcZ1FKJF1dKFrL8oI8SA.',
    is_admin = TRUE,
    email = 'cleverson@sgiptv.com.br'
WHERE login = 'CleversonS';

-- Atualiza admin (Senha: fazenda123)
UPDATE fazenda_usuarios
SET senha = '$2b$10$0NxJKn6qXaPLtNVC7m4saOgrfQrophBxpKdHJQu1NpJk5oG0wWOYi',
    is_admin = TRUE,
    email = 'admin@sgiptv.com.br'
WHERE login = 'admin';

-- Garante que o ID 1 seja do CleversonS de forma segura
DO $$
BEGIN
    -- Se o login existe, tentamos garantir o ID 1
    IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS') THEN
        
        -- Se o ID 1 já estiver ocupado por outro login, movemos o outro usuário para um novo ID
        IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE id = 1 AND login != 'CleversonS') THEN
            UPDATE fazenda_usuarios 
            SET id = (SELECT MAX(id) + 1 FROM fazenda_usuarios) 
            WHERE id = 1;
        END IF;

        -- Define CleversonS como ID 1
        UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';
        
        -- Sincroniza a sequência da tabela para evitar conflitos de ID em inserções futuras
        PERFORM setval(pg_get_serial_sequence('fazenda_usuarios', 'id'), COALESCE((SELECT MAX(id) FROM fazenda_usuarios), 1), true);
    END IF;
END $$;
