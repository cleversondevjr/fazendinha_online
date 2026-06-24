-- farm2.0 Initial Schema (PostgreSQL Version)

-- 1. Configuration Table (General Settings)
CREATE TABLE IF NOT EXISTS fazenda_config (
    chave VARCHAR(50) PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Item and Crop Configuration
CREATE TABLE IF NOT EXISTS fazenda_itens_config (
    item_id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- item, flower, tree, pack_gold, pack_diamond
    label VARCHAR(100),
    price_coins INT DEFAULT 0,
    price_diamonds INT DEFAULT 0,
    reward_base INT DEFAULT 0,
    grow_hours DECIMAL(10, 2) DEFAULT 0,
    desconto_percent INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Inventory Table
CREATE TABLE IF NOT EXISTS fazenda_inventario (
    usuario_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantidade INT DEFAULT 0,
    PRIMARY KEY (usuario_id, item_id)
);
CREATE INDEX idx_inventario_usuario ON fazenda_inventario(usuario_id);

-- 4. Farm Slots / Plantations
CREATE TABLE IF NOT EXISTS fazenda_plantacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    slot_index INT NOT NULL,
    fase VARCHAR(50) DEFAULT 'locked', -- locked, needsPot, needsWater, readyToPlant, growing, ready
    pot_type VARCHAR(50),
    pot_expires_at TIMESTAMP,
    crop_id VARCHAR(50),
    reward_base DECIMAL(10, 2) DEFAULT 0,
    reward_actual DECIMAL(10, 2) DEFAULT 0,
    started_at TIMESTAMP,
    ends_at TIMESTAMP,
    pause_started_at TIMESTAMP,
    total_paused_ms BIGINT DEFAULT 0,
    last_pest_check TIMESTAMP,
    pest_active BOOLEAN DEFAULT FALSE,
    crow_active BOOLEAN DEFAULT FALSE,
    scarecrow_until TIMESTAMP,
    UNIQUE (usuario_id, slot_index)
);
CREATE INDEX idx_plantacoes_usuario ON fazenda_plantacoes(usuario_id);

-- 5. Mission Templates
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

-- 6. User Active Missions
CREATE TABLE IF NOT EXISTS fazenda_missoes_jogador (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    template_id INT NOT NULL,
    progress INT DEFAULT 0,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (template_id) REFERENCES fazenda_missoes_template(id)
);
CREATE INDEX idx_missoes_usuario ON fazenda_missoes_jogador(usuario_id);

-- 7. World Tree Meta
CREATE TABLE IF NOT EXISTS fazenda_arvore_meta (
    id SERIAL PRIMARY KEY,
    data_dia DATE NOT NULL,
    meta_agua INT NOT NULL,
    agua_atual INT DEFAULT 0,
    recompensa_liberada BOOLEAN DEFAULT FALSE,
    UNIQUE (data_dia)
);

-- 8. World Tree Contributions
CREATE TABLE IF NOT EXISTS fazenda_arvore_contribuicoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    data_dia DATE NOT NULL,
    janela_6h INT NOT NULL, -- 0, 1, 2, 3
    quantidade INT DEFAULT 0,
    recompensa_coletada BOOLEAN DEFAULT FALSE,
    UNIQUE (usuario_id, data_dia, janela_6h)
);
CREATE INDEX idx_arvore_contri_usuario_dia ON fazenda_arvore_contribuicoes(usuario_id, data_dia);
CREATE INDEX idx_arvore_contri_dia ON fazenda_arvore_contribuicoes(data_dia);
