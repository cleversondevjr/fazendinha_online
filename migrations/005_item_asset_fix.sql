-- Migração 005: Novos campos para Itens e Perigos
-- Adiciona a coluna image_asset que pode ter faltado em inicializações anteriores

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='fazenda_itens_config' AND COLUMN_NAME='image_asset') THEN
        ALTER TABLE fazenda_itens_config ADD COLUMN image_asset TEXT;
    END IF;
END $$;
