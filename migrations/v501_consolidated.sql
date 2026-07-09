-- Fazendinha Online v5.0.1 - Consolidated Database Migration
-- All-in-one schema, seed data, and configuration

-- =============================================================================
-- 1. SCHEMAS & TABLES
-- =============================================================================

-- Users Table
CREATE TABLE IF NOT EXISTS fazenda_usuarios (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    total_gold_generated BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Session Table (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Configuration Table
CREATE TABLE IF NOT EXISTS fazenda_config (
    chave VARCHAR(50) PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Item and Crop Configuration
CREATE TABLE IF NOT EXISTS fazenda_itens_config (
    item_id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- item, flower, tree, pack_gold, pack_diamond
    label VARCHAR(100),
    price_coins INT DEFAULT 0,
    price_diamonds INT DEFAULT 0,
    reward_base BIGINT DEFAULT 0,
    grow_hours DECIMAL(10, 2) DEFAULT 0,
    image_asset VARCHAR(255),
    desconto_percent INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS fazenda_inventario (
    usuario_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantidade BIGINT DEFAULT 0,
    PRIMARY KEY (usuario_id, item_id),
    FOREIGN KEY (usuario_id) REFERENCES fazenda_usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inventario_usuario ON fazenda_inventario(usuario_id);

-- Farm Slots / Plantations
CREATE TABLE IF NOT EXISTS fazenda_plantacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    slot_index INT NOT NULL,
    fase VARCHAR(50) DEFAULT 'locked', -- locked, needsPot, needsWater, readyToPlant, growing, ready
    pot_type VARCHAR(50),
    pot_expires_at TIMESTAMP WITH TIME ZONE,
    water_expires_at TIMESTAMP WITH TIME ZONE,
    crop_id VARCHAR(50),
    reward_base BIGINT DEFAULT 0,
    reward_actual BIGINT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    pause_started_at TIMESTAMP WITH TIME ZONE,
    total_paused_ms BIGINT DEFAULT 0,
    last_pest_check TIMESTAMP WITH TIME ZONE,
    pest_active BOOLEAN DEFAULT FALSE,
    crow_active BOOLEAN DEFAULT FALSE,
    scarecrow_until TIMESTAMP WITH TIME ZONE,
    UNIQUE (usuario_id, slot_index),
    FOREIGN KEY (usuario_id) REFERENCES fazenda_usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_plantacoes_usuario ON fazenda_plantacoes(usuario_id);

-- Roadmap / Feature Flags
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

-- Mission Templates
CREATE TABLE IF NOT EXISTS fazenda_missoes_template (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    target INT NOT NULL,
    reward_type VARCHAR(50) NOT NULL, -- coins, diamante, energia
    reward_amount INT NOT NULL,
    weight INT DEFAULT 1,
    active BOOLEAN DEFAULT TRUE
);

-- User Active Missions
CREATE TABLE IF NOT EXISTS fazenda_missoes_jogador (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    template_id INT NOT NULL,
    progress INT DEFAULT 0,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (template_id) REFERENCES fazenda_missoes_template(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES fazenda_usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_missoes_usuario ON fazenda_missoes_jogador(usuario_id);

-- World Tree Meta
CREATE TABLE IF NOT EXISTS fazenda_arvore_meta (
    id SERIAL PRIMARY KEY,
    data_dia DATE NOT NULL,
    meta_agua INT NOT NULL,
    agua_atual INT DEFAULT 0,
    recompensa_liberada BOOLEAN DEFAULT FALSE,
    UNIQUE (data_dia)
);

-- World Tree Contributions
CREATE TABLE IF NOT EXISTS fazenda_arvore_contribuicoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    data_dia DATE NOT NULL,
    janela_6h INT NOT NULL, -- 0, 1, 2, 3
    quantidade INT DEFAULT 0,
    recompensa_coletada BOOLEAN DEFAULT FALSE,
    UNIQUE (usuario_id, data_dia, janela_6h),
    FOREIGN KEY (usuario_id) REFERENCES fazenda_usuarios(id) ON DELETE CASCADE
);

-- Daily Check-in
CREATE TABLE IF NOT EXISTS fazenda_checkin (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES fazenda_usuarios(id) ON DELETE CASCADE,
    data_dia DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, data_dia)
);

-- Audit Logs (Admin)
CREATE TABLE IF NOT EXISTS fazenda_admin_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    acao TEXT NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (usuario_id) REFERENCES fazenda_usuarios(id) ON DELETE SET NULL
);

-- Generic Audit Logs (Economic)
CREATE TABLE IF NOT EXISTS fazenda_audit_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES fazenda_usuarios(id) ON DELETE CASCADE,
    acao VARCHAR(100) NOT NULL,
    valor_anterior JSONB,
    valor_novo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace (P2P)
CREATE TABLE IF NOT EXISTS fazenda_marketplace (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER REFERENCES fazenda_usuarios(id) ON DELETE CASCADE NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantidade BIGINT NOT NULL,
    preco_diamante BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'listing', -- listing, sold, cancelled, vault
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Season Pass
CREATE TABLE IF NOT EXISTS fazenda_season_pass_template (
    nivel INTEGER PRIMARY KEY,
    recompensa_tipo VARCHAR(50),
    recompensa_quantidade BIGINT,
    xp_required INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS fazenda_season_pass_progresso (
    usuario_id INTEGER PRIMARY KEY REFERENCES fazenda_usuarios(id) ON DELETE CASCADE,
    nivel_atual INTEGER DEFAULT 1,
    xp_atual INTEGER DEFAULT 0,
    claimed_levels INTEGER[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2. SEED DATA
-- =============================================================================

-- Initial Configuration
INSERT INTO fazenda_config (chave, valor, descricao) VALUES
('version', 'v5.0.1', 'Versão interna do sistema'),
('game_version', 'v5.0.1', 'Versão exibida na interface'),
('max_energy', '100', 'Energia máxima do jogador'),
('energy_restore_per_hour', '5', 'Energia recuperada por hora'),
('crow_chance_percent', '10', 'Chance de aparecimento de corvos'),
('pest_chance_percent', '20', 'Chance de aparecimento de pragas'),
('global_discount', '0', 'Desconto global na loja (%)'),
('world_tree_active_users_last_week', '1', 'Usuários ativos na semana anterior'),
('slot_price_base', '500', 'Preço base para terrenos'),
('active_layout', 'default', 'Layout ativo (default, immersive, retro, neon)'),
('pot_duration_hours', '168', 'Duração do vaso em horas (7 dias)'),
('water_duration_hours', '24', 'Duração da água em horas (1 dia)'),
('maintenance_mode', 'false', 'Ativa o modo de manutenção global'),
('marketplace_tax_percent', '10', 'Taxa de queima do marketplace em %')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- Feature Flags
INSERT INTO fazenda_features (chave, label, ativa, fase) VALUES
('MODULO_BASE', 'Módulo Base (Slots 1-6, Água, Potes)', TRUE, 1),
('LOJA_DIAMANTE', 'Loja de Diamantes e Pacotes', TRUE, 2),
('PASSE_TEMPORADA', 'Passe de Temporada (Níveis 1-30)', TRUE, 3),
('SEMENTES_RARAS', 'Sementes Raras (Drops e Recompensas)', TRUE, 3),
('SLOTS_PREMIUM', 'Slots Premium (7 e 8)', TRUE, 4),
('CONVERSAO_DIAMANTE', 'Conversão Ouro -> Diamante', TRUE, 4),
('MARKETPLACE', 'Marketplace P2P (Escrow)', TRUE, 5),
('CHECKIN_DIARIO', 'Check-in Diário', TRUE, 1)
ON CONFLICT (chave) DO UPDATE SET ativa = TRUE;

-- Items and Crops
INSERT INTO fazenda_itens_config (item_id, tipo, label, price_coins, price_diamonds, reward_base, grow_hours, image_asset) VALUES
('vasoPequeno', 'item', 'Pote Pequeno', 20, 0, 0, 0, 'vaso_pequeno.png'),
('vasoGrande', 'item', 'Pote Grande', 40, 0, 0, 0, 'vaso_grande.png'),
('agua', 'item', 'Água', 10, 0, 0, 0, 'agua.png'),
('pesticida', 'item', 'Pesticida', 35, 0, 0, 0, 'borrifador_inseticida.png'),
('espantalho', 'item', 'Espantalho', 0, 500, 0, 0, 'espantalho.png'),
('flor_01_rosa_adulta', 'flower', 'Rosa', 100, 0, 150, 0.03, 'flores/flor_01_rosa_adulta.png'),
('flor_02_girassol_adulta', 'flower', 'Girassol', 100, 0, 150, 0.03, 'flores/flor_02_girassol_adulta.png'),
('flor_03_roxa_adulta', 'flower', 'Roxa', 100, 0, 150, 0.03, 'flores/flor_03_roxa_adulta.png'),
('flor_04_azul_adulta', 'flower', 'Azul', 100, 0, 150, 0.03, 'flores/flor_04_azul_adulta.png'),
('flor_05_laranja_adulta', 'flower', 'Laranja', 100, 0, 150, 0.03, 'flores/flor_05_laranja_adulta.png'),
('flor_06_branca_adulta', 'flower', 'Branca', 100, 0, 150, 0.03, 'flores/flor_06_branca_adulta.png'),
('flor_07_vermelha_adulta', 'flower', 'Vermelha', 100, 0, 150, 0.03, 'flores/flor_07_vermelha_adulta.png'),
('flor_08_violeta_adulta', 'flower', 'Violeta', 100, 0, 150, 0.03, 'flores/flor_08_violeta_adulta.png'),
('flor_09_lilas_adulta', 'flower', 'Lilás', 100, 0, 150, 0.03, 'flores/flor_09_lilas_adulta.png'),
('flor_10_teal_adulta', 'flower', 'Teal', 100, 0, 150, 0.03, 'flores/flor_10_teal_adulta.png'),
('arvore_01_frutifera_adulta', 'tree', 'Árvore Frutífera', 250, 0, 438, 0.08, 'flores/arvore_01_frutifera_adulta.png'),
('arvore_02_copa_adulta', 'tree', 'Árvore Copa', 250, 0, 438, 0.08, 'flores/arvore_02_copa_adulta.png'),
('arvore_03_ornamental_adulta', 'tree', 'Árvore Ornamental', 250, 0, 438, 0.08, 'flores/arvore_03_ornamental_adulta.png'),
('arvore_04_volumosa_adulta', 'tree', 'Árvore Volumosa', 250, 0, 438, 0.08, 'flores/arvore_04_volumosa_adulta.png'),
('arvore_05_alta_adulta', 'tree', 'Árvore Alta', 250, 0, 438, 0.08, 'flores/arvore_05_alta_adulta.png'),
('pack_diamante_1', 'pack_diamond', 'Pacote Bronze', 0, 0, 0, 0, 'diamante.png'),
('conv_diamante_1', 'pack_gold', 'Conversão Mini', 0, 10000, 0, 0, 'ouro.png')
ON CONFLICT (item_id) DO UPDATE SET image_asset = EXCLUDED.image_asset;

-- Mission Templates
INSERT INTO fazenda_missoes_template (label, tipo, target, reward_type, reward_amount, weight) VALUES
('Plante 2 flores', 'plant_flowers', 2, 'coins', 120, 10),
('Plante 1 árvore', 'plant_trees', 1, 'coins', 180, 10),
('Regue 3 slots', 'water_slots', 3, 'energia', 8, 10),
('Compre 1 terreno', 'unlock_slot', 1, 'coins', 250, 5),
('Colete 400 ouro', 'harvest_gold', 400, 'diamante', 20, 8),
('Remova 1 corvo', 'remove_crow', 1, 'coins', 140, 10),
('Use pesticida 1 vez', 'use_pesticide', 1, 'coins', 120, 10),
('Colha 3 plantas', 'harvest_count', 3, 'coins', 220, 10)
ON CONFLICT DO NOTHING;

-- Season Pass (30 Levels)
DO $$
BEGIN
    FOR i IN 1..30 LOOP
        INSERT INTO fazenda_season_pass_template (nivel, recompensa_tipo, recompensa_quantidade, xp_required)
        VALUES (i, CASE WHEN i % 5 = 0 THEN 'diamante' ELSE 'coins' END, i * 100, 100)
        ON CONFLICT (nivel) DO NOTHING;
    END LOOP;
END $$;

-- =============================================================================
-- 3. ADMIN CREDENTIALS & CLEANUP
-- =============================================================================

-- Ensure CleversonS is Admin and has ID 1
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM fazenda_usuarios WHERE login = 'CleversonS' AND id <> 1) THEN
        UPDATE fazenda_usuarios SET id = 9999 WHERE id = 1;
        UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';
    END IF;

    INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
    VALUES (1, 'CleversonS', 'cleversonS@exemplo.com', 'Wincster@194060le', TRUE)
    ON CONFLICT (id) DO UPDATE SET senha = 'Wincster@194060le', is_admin = TRUE;

    INSERT INTO fazenda_usuarios (id, login, email, senha, is_admin)
    VALUES (2, 'admin', 'admin@fazendinha.com', 'fazenda123', TRUE)
    ON CONFLICT (id) DO UPDATE SET senha = 'fazenda123', is_admin = TRUE;

    PERFORM setval('fazenda_usuarios_id_seq', (SELECT MAX(id) FROM fazenda_usuarios));
END $$;
