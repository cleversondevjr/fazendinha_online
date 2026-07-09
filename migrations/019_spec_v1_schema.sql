-- Migração Spec V1.0: Infraestrutura Econômica e Social

-- 1. Precisão Numérica: Alterar quantidades para BIGINT
ALTER TABLE fazenda_inventario ALTER COLUMN quantidade TYPE BIGINT;
ALTER TABLE fazenda_plantacoes ALTER COLUMN reward_base TYPE BIGINT;
ALTER TABLE fazenda_plantacoes ALTER COLUMN reward_actual TYPE BIGINT;
ALTER TABLE fazenda_usuarios ADD COLUMN IF NOT EXISTS total_gold_generated BIGINT DEFAULT 0;

-- 2. Logs de Auditoria
CREATE TABLE IF NOT EXISTS fazenda_audit_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES fazenda_usuarios(id),
    acao VARCHAR(100) NOT NULL,
    valor_anterior JSONB,
    valor_novo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Marketplace (P2P)
CREATE TABLE IF NOT EXISTS fazenda_marketplace (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER REFERENCES fazenda_usuarios(id) NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantidade BIGINT NOT NULL,
    preco_diamante BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'listing', -- listing, sold, cancelled, vault
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Passe de Temporada
CREATE TABLE IF NOT EXISTS fazenda_season_pass_template (
    nivel INTEGER PRIMARY KEY,
    recompensa_tipo VARCHAR(50),
    recompensa_quantidade BIGINT,
    xp_required INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS fazenda_season_pass_progresso (
    usuario_id INTEGER PRIMARY KEY REFERENCES fazenda_usuarios(id),
    nivel_atual INTEGER DEFAULT 1,
    xp_atual INTEGER DEFAULT 0,
    claimed_levels INTEGER[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Configurações de Manutenção e Sistema
INSERT INTO fazenda_config (chave, valor, descricao) VALUES
('maintenance_mode', 'false', 'Ativa o modo de manutenção global'),
('maintenance_bypass_ips', '[]', 'Lista de IPs permitidos durante manutenção'),
('last_quest_rotation', '2024-01-01 00:00:00', 'Timestamp da última rotação de missões'),
('marketplace_tax_percent', '10', 'Taxa de queima do marketplace em %')
ON CONFLICT (chave) DO NOTHING;

-- 6. Inserir Itens dos Pacotes na Configuração de Itens
INSERT INTO fazenda_itens_config (item_id, tipo, label, price_diamonds, price_coins) VALUES
-- Pacotes de Diamantes (Dinheiro Real - Placeholder de preços em Diamantes para lógica de bônus)
('pack_diamante_1', 'pack_diamond', 'Pacote Bronze', 0, 0), -- Preço R$ 10
('pack_diamante_2', 'pack_diamond', 'Pacote Prata', 0, 0), -- Preço R$ 50
('pack_diamante_3', 'pack_diamond', 'Pacote Ouro', 0, 0), -- Preço R$ 100
('pack_diamante_4', 'pack_diamond', 'Pacote Platina', 0, 0), -- Preço R$ 200
('pack_diamante_5', 'pack_diamond', 'Pacote Diamante', 0, 0), -- Preço R$ 500
('pack_diamante_6', 'pack_diamond', 'Pacote Lendário', 0, 0), -- Preço R$ 1000

-- Pacotes de Conversão (Ouro -> Diamante)
('conv_diamante_1', 'pack_gold', 'Conversão Mini', 0, 10000),
('conv_diamante_2', 'pack_gold', 'Conversão Básica', 0, 50000),
('conv_diamante_3', 'pack_gold', 'Conversão Média', 0, 100000),
('conv_diamante_4', 'pack_gold', 'Conversão Grande', 0, 250000),
('conv_diamante_5', 'pack_gold', 'Conversão Mega', 0, 500000),
('conv_diamante_6', 'pack_gold', 'Conversão Ultra', 0, 1000000)
ON CONFLICT (item_id) DO NOTHING;

-- 7. Seed do Passe de Temporada (30 Níveis)
DO $$
BEGIN
    FOR i IN 1..30 LOOP
        INSERT INTO fazenda_season_pass_template (nivel, recompensa_tipo, recompensa_quantidade, xp_required)
        VALUES (i, CASE WHEN i % 5 = 0 THEN 'diamante' ELSE 'coins' END, i * 100, 100)
        ON CONFLICT (nivel) DO NOTHING;
    END LOOP;
END $$;
