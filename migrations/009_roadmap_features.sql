-- Tabela de Controle de Roadmap (Feature Flags)
CREATE TABLE IF NOT EXISTS fazenda_features (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    ativa BOOLEAN DEFAULT FALSE,
    data_lancamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mensagem_bloqueio TEXT DEFAULT 'Esta função será liberada em breve!',
    fase INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Auditoria (Logs do Painel Admin)
CREATE TABLE IF NOT EXISTS fazenda_admin_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    acao TEXT NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir as Feature Flags Iniciais baseadas no Roadmap Sugerido
INSERT INTO fazenda_features (chave, label, ativa, data_lancamento, fase) VALUES
('MODULO_BASE', 'Módulo Base (Slots 1-6, Água, Potes)', TRUE, NOW(), 1),
('LOJA_DIAMANTE', 'Loja de Diamantes e Pacotes', FALSE, NOW() + INTERVAL '15 days', 2),
('PASSE_TEMPORADA', 'Passe de Temporada (Níveis 1-30)', FALSE, NOW() + INTERVAL '30 days', 3),
('SEMENTES_RARAS', 'Sementes Raras (Drops e Recompensas)', FALSE, NOW() + INTERVAL '45 days', 3),
('SLOTS_PREMIUM', 'Slots Premium (7 e 8)', FALSE, NOW() + INTERVAL '60 days', 4),
('CONVERSAO_DIAMANTE', 'Conversão Ouro -> Diamante', FALSE, NOW() + INTERVAL '75 days', 4)
ON CONFLICT (chave) DO NOTHING;
