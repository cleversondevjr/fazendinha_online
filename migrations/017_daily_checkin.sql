-- Tabela para registrar check-ins diários
CREATE TABLE IF NOT EXISTS fazenda_checkin (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES fazenda_usuarios(id) ON DELETE CASCADE,
    data_dia DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, data_dia)
);

-- Adicionar Feature Flag para Check-in Diário
INSERT INTO fazenda_features (chave, label, ativa, data_lancamento, fase)
VALUES ('CHECKIN_DIARIO', 'Check-in Diário', TRUE, NOW(), 1)
ON CONFLICT (chave) DO UPDATE SET ativa = TRUE;
