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
