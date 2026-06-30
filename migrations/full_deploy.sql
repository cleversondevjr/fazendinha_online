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
    image_asset VARCHAR(255),
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
-- farm2.0 Seed Data (PostgreSQL Version)

-- Initial Configuration
INSERT INTO fazenda_config (chave, valor, descricao) VALUES
('max_energy', '100', 'Energia máxima do jogador'),
('energy_restore_per_hour', '5', 'Energia recuperada por hora'),
('crow_chance_percent', '10', 'Chance de aparecimento de corvos'),
('pest_chance_percent', '20', 'Chance de aparecimento de pragas'),
('global_discount', '0', 'Desconto global na loja (%)'),
('world_tree_active_users_last_week', '1', 'Usuários ativos na semana anterior (padrão 1)'),
('slot_price_base', '500', 'Preço base para comprar novos terrenos')
ON CONFLICT (chave) DO NOTHING;

-- Items and Crops
INSERT INTO fazenda_itens_config (item_id, tipo, label, price_coins, price_diamonds, reward_base, grow_hours) VALUES
('vasoPequeno', 'item', 'Pote Pequeno', 20, 0, 0, 0),
('vasoGrande', 'item', 'Pote Grande', 40, 0, 0, 0),
('agua', 'item', 'Água', 10, 0, 0, 0),
('pesticida', 'item', 'Pesticida', 35, 0, 0, 0),
('espantalho', 'item', 'Espantalho', 0, 500, 0, 0),
('flor_01_rosa_adulta', 'flower', 'Rosa', 100, 0, 150, 0.03),
('flor_02_girassol_adulta', 'flower', 'Girassol', 100, 0, 150, 0.03),
('flor_03_roxa_adulta', 'flower', 'Roxa', 100, 0, 150, 0.03),
('flor_04_azul_adulta', 'flower', 'Azul', 100, 0, 150, 0.03),
('flor_05_laranja_adulta', 'flower', 'Laranja', 100, 0, 150, 0.03),
('flor_06_branca_adulta', 'flower', 'Branca', 100, 0, 150, 0.03),
('flor_07_vermelha_adulta', 'flower', 'Vermelha', 100, 0, 150, 0.03),
('flor_08_violeta_adulta', 'flower', 'Violeta', 100, 0, 150, 0.03),
('flor_09_lilas_adulta', 'flower', 'Lilás', 100, 0, 150, 0.03),
('flor_10_teal_adulta', 'flower', 'Teal', 100, 0, 150, 0.03),
('arvore_01_frutifera_adulta', 'tree', 'Árvore Frutífera', 250, 0, 438, 0.08),
('arvore_02_copa_adulta', 'tree', 'Árvore Copa', 250, 0, 438, 0.08),
('arvore_03_ornamental_adulta', 'tree', 'Árvore Ornamental', 250, 0, 438, 0.08),
('arvore_04_volumosa_adulta', 'tree', 'Árvore Volumosa', 250, 0, 438, 0.08),
('arvore_05_alta_adulta', 'tree', 'Árvore Alta', 250, 0, 438, 0.08)
ON CONFLICT (item_id) DO NOTHING;

-- Mission Templates
INSERT INTO fazenda_missoes_template (label, tipo, target, reward_type, reward_amount, weight) VALUES
('Plante 2 flores', 'plant_flowers', 2, 'coins', 120, 10),
('Plante 1 árvore', 'plant_trees', 1, 'coins', 180, 10),
('Regue 3 slots', 'water_slots', 3, 'energia', 8, 10),
('Compre 1 terreno', 'unlock_slot', 1, 'coins', 250, 5),
('Colete 400 ouro', 'harvest_gold', 400, 'diamante', 20, 8),
('Remova 1 corvo', 'remove_crow', 1, 'coins', 140, 10),
('Use pesticida 1 vez', 'use_pesticide', 1, 'coins', 120, 10),
('Colha 3 plantas', 'harvest_count', 3, 'coins', 220, 10),
('Doe 100 ouro para a Árvore Mundial', 'donate_tree', 100, 'energia', 5, 10),
('Plante 5 flores', 'plant_flowers', 5, 'coins', 350, 5),
('Regue 10 slots', 'water_slots', 10, 'energia', 25, 5),
('Remova 5 corvos', 'remove_crow', 5, 'diamante', 50, 3),
('Colete 1000 ouro', 'harvest_gold', 1000, 'diamante', 50, 4),
('Colha 10 plantas', 'harvest_count', 10, 'coins', 800, 4),
('Use 5 pesticidas', 'use_pesticide', 5, 'coins', 500, 5),
('Doe para a árvore 3 vezes', 'donate_tree_count', 3, 'diamante', 15, 7),
('Plante 2 árvores', 'plant_trees', 2, 'coins', 400, 5),
('Mantenha o espantalho ativo', 'scarecrow_active', 1, 'coins', 100, 10),
('Compre 5 itens na loja', 'buy_shop', 5, 'energia', 15, 8),
('Gaste 500 ouro', 'spend_gold', 500, 'energia', 10, 10),
('Gaste 50 diamantes', 'spend_diamonds', 50, 'coins', 1000, 2),
('Regue a Árvore Mundial', 'water_world_tree', 1, 'coins', 50, 10),
('Complete 3 missões', 'complete_missions', 3, 'diamante', 30, 2),
('Plante Rosa e Girassol', 'plant_specific_flower', 2, 'coins', 300, 5),
('Tenha 5 slots ativos', 'active_slots', 5, 'coins', 500, 3),
('Colete recompensa da Árvore Mundial', 'collect_tree_reward', 1, 'diamante', 10, 5),
('Plante uma Árvore Frutífera', 'plant_specific_tree', 1, 'coins', 200, 7),
('Use 2 potes grandes', 'use_big_pot', 2, 'coins', 150, 8),
('Use 5 potes pequenos', 'use_small_pot', 5, 'coins', 150, 8),
('Fique online por 1 hora', 'online_time', 60, 'energia', 20, 5),
('Colha uma planta jovem', 'harvest_young', 1, 'coins', 50, 5),
('Use 3 águas em um único slot', 'water_triple', 1, 'coins', 80, 6),
('Remova uma praga rapidamente', 'fast_pest_removal', 1, 'coins', 100, 7),
('Economize 2000 ouro', 'save_gold', 2000, 'diamante', 25, 4),
('Compre um item de diamante', 'buy_diamond_item', 1, 'energia', 50, 2),
('Ajude 5 vizinhos (placeholder)', 'help_neighbors', 5, 'coins', 300, 1),
('Plante 10 sementes', 'plant_seeds', 10, 'coins', 400, 6),
('Regue em 4 períodos diferentes', 'water_periods', 4, 'diamante', 40, 3),
('Doe 500 ouro para a Árvore', 'donate_tree', 500, 'diamante', 10, 5),
('Tenha 2 espantalhos', 'scarecrow_count', 2, 'coins', 300, 3),
('Colha todas as flores do campo', 'harvest_all_flowers', 1, 'coins', 600, 3),
('Plante apenas árvores', 'only_trees', 3, 'coins', 500, 2),
('Use 10 pesticidas no dia', 'pesticide_daily', 10, 'diamante', 60, 2),
('Espante 3 corvos seguidos', 'crows_streak', 3, 'coins', 250, 4),
('Colete 100 ouro de uma vez', 'large_harvest', 1, 'energia', 5, 8),
('Doe energia para a árvore', 'donate_energy', 10, 'coins', 500, 5),
('Compre 2 terrenos novos', 'unlock_slots', 2, 'diamante', 100, 1),
('Complete a meta diária da árvore', 'complete_tree_daily', 1, 'diamante', 50, 1),
('Regue o jardim de manhã', 'morning_water', 3, 'coins', 100, 5),
('Colha à noite', 'night_harvest', 3, 'coins', 100, 5),
('Use o Pote Grande na Flor', 'weird_planting', 1, 'coins', 50, 5);
-- Add active_layout config
INSERT INTO fazenda_config (chave, valor, descricao) VALUES
('active_layout', 'default', 'Layout ativo do jogo (default, immersive, retro, neon)')
ON CONFLICT (chave) DO NOTHING;
-- Migração 004: Suporte para Pausa de Crescimento e Expiradores
-- Esta migração adiciona campos necessários para pausar o crescimento quando o pote ou água expiram.

ALTER TABLE fazenda_plantacoes
ADD COLUMN total_paused_ms BIGINT DEFAULT 0,
ADD COLUMN pause_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN pot_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN water_expires_at TIMESTAMP WITH TIME ZONE;

-- Adicionar configurações globais para durações padrão se não existirem
INSERT INTO fazenda_config (chave, valor, descricao)
VALUES
('pot_duration_hours', '168', 'Duração do vaso em horas (padrão 7 dias)'),
('water_duration_hours', '24', 'Duração da água em horas (padrão 1 dia)')
ON CONFLICT (chave) DO NOTHING;
-- Migração 005: Novos campos para Itens e Perigos
-- Adiciona a coluna image_asset que pode ter faltado em inicializações anteriores

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_itens_config' AND COLUMN_NAME='image_asset') THEN
        ALTER TABLE fazenda_itens_config ADD COLUMN image_asset TEXT;
    END IF;
END $$;
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
INSERT INTO fazenda_usuarios (login, senha, email, is_admin)
VALUES ('CleversonS', '$2b$10$lgfvlbEtjbg2fYeM6oiwJ.Ex3YapDgJ3RXDVN7KIiCdxsub2eHQ0S', 'cleverson@sgiptv.com.br', TRUE)
ON CONFLICT (login) DO UPDATE SET
    senha = EXCLUDED.senha,
    is_admin = TRUE;

-- Garantir que a versão do jogo está no config
INSERT INTO fazenda_config (chave, valor, descricao)
VALUES ('game_version', 'v1.0.5', 'Versão atual exibida na topbar')
ON CONFLICT (chave) DO NOTHING;

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
