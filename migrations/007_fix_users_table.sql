-- Migração de Segurança e Correção de Esquema
-- Garante que todas as colunas críticas existam sem derrubar as tabelas

-- 1. Correção da tabela fazenda_usuarios
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_usuarios' AND COLUMN_NAME='email') THEN
        ALTER TABLE fazenda_usuarios ADD COLUMN email VARCHAR(100) UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_usuarios' AND COLUMN_NAME='is_admin') THEN
        ALTER TABLE fazenda_usuarios ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_usuarios' AND COLUMN_NAME='created_at') THEN
        ALTER TABLE fazenda_usuarios ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- 2. Correção da tabela fazenda_plantacoes (Migração 004 repetida por segurança)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_plantacoes' AND COLUMN_NAME='total_paused_ms') THEN
        ALTER TABLE fazenda_plantacoes ADD COLUMN total_paused_ms BIGINT DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_plantacoes' AND COLUMN_NAME='pause_started_at') THEN
        ALTER TABLE fazenda_plantacoes ADD COLUMN pause_started_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_plantacoes' AND COLUMN_NAME='pot_expires_at') THEN
        ALTER TABLE fazenda_plantacoes ADD COLUMN pot_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_plantacoes' AND COLUMN_NAME='water_expires_at') THEN
        ALTER TABLE fazenda_plantacoes ADD COLUMN water_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. Correção da tabela fazenda_itens_config (Migração 005 repetida por segurança)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_itens_config' AND COLUMN_NAME='image_asset') THEN
        ALTER TABLE fazenda_itens_config ADD COLUMN image_asset TEXT;
    END IF;
END $$;

-- 4. Garantir Usuários Admin (Cleverson e Admin padrão)
-- Usando a senha 'fazenda123' como fallback se necessário, mas mantendo o hash se já existir
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('CleversonS', '$2b$10$21px.CyYaTSTSE8QAssmjeBgtjlFTT9LywN9b4mwD16xuQlZi5phu', 'cleverson@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    is_admin = TRUE,
    email = EXCLUDED.email;

INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('admin', '$2b$10$L07O.E.oU/XpMvK3wUeRveY9YjXvQ0Z2kYjY6XpYjY6XpYjY6XpYj', 'admin@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    is_admin = TRUE;
