-- Migração para suporte a usuários com login e senha
CREATE TABLE IF NOT EXISTS fazenda_usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir usuário padrão se não existir
INSERT INTO fazenda_usuarios (id, login, senha, email)
VALUES (1, 'admin', 'Admin@123', 'admin@sgiptv.com.br')
ON CONFLICT (id) DO NOTHING;

-- Garantir que a versão do jogo está no config
INSERT INTO fazenda_config (chave, valor, descricao)
VALUES ('game_version', 'v1.0.5', 'Versão atual exibida na topbar')
ON CONFLICT (chave) DO NOTHING;
