-- Migração para suporte a usuários com login e senha
CREATE TABLE IF NOT EXISTS fazenda_usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir usuário padrão se não existir
INSERT INTO fazenda_usuarios (id, login, senha, email, is_admin)
VALUES (1, 'admin', '$2b$10$L07O.E.oU/XpMvK3wUeRveY9YjXvQ0Z2kYjY6XpYjY6XpYjY6XpYj', 'admin@sgiptv.com.br', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Usuário Admin específico solicitado (Senha com Hashing Bcrypt)
-- Usuário Admin específico solicitado (Senha com Hashing Bcrypt atualizada)
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('CleversonS', '$2b$10$21px.CyYaTSTSE8QAssmjeBgtjlFTT9LywN9b4mwD16xuQlZi5phu', 'cleverson@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    senha = EXCLUDED.senha,
    is_admin = TRUE;

-- Garantir que a versão do jogo está no config
INSERT INTO fazenda_config (chave, valor, descricao)
VALUES ('game_version', 'v1.1.0', 'Versão atual exibida na topbar')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- Session Table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
