const express = require('express');
const router = express.Router();
const db = require('../db');

// --- Helper: Initialize User Data ---
async function ensureUserInitialized(userId) {
    const slots = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1', [userId]);
    if (slots.rows.length === 0) {
        for (let i = 0; i < 8; i++) {
            await db.execute('INSERT INTO fazenda_plantacoes (usuario_id, slot_index, fase) VALUES ($1, $2, $3)', [userId, i, i === 0 ? 'needsPot' : 'locked']);
        }
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', 1000), ($1, 'energia', 100)", [userId]);
        await db.execute("INSERT INTO fazenda_config (chave, valor) VALUES ('last_energy_sync_' || $1, NOW()::text) ON CONFLICT (chave) DO NOTHING", [userId]);
    }
}

// --- Helper: Energy Restore ---
async function syncEnergy(userId, configs) {
    const key = `last_energy_sync_${userId}`;
    const lastSyncStr = configs[key];
    if (!lastSyncStr) return;

    const lastSync = new Date(lastSyncStr).getTime();
    const now = Date.now();
    const elapsedHours = (now - lastSync) / 3600000;
    const restoreRate = parseInt(configs.energy_restore_per_hour || 5);
    const maxEnergy = parseInt(configs.max_energy || 100);

    const toRestore = Math.floor(elapsedHours * restoreRate);
    if (toRestore > 0) {
        await db.execute("UPDATE fazenda_inventario SET quantidade = LEAST($1, quantidade + $2) WHERE usuario_id = $3 AND item_id = 'energia'", [maxEnergy, toRestore, userId]);
        await db.execute("UPDATE fazenda_config SET valor = $1 WHERE chave = $2", [new Date().toISOString(), key]);
    }
}

// --- Helper: Process Plot State ---
function calculatePlotState(plot, configs) {
    if (plot.fase !== 'growing' && plot.fase !== 'ready') return plot;
    const now = Date.now();
    const started = new Date(plot.started_at).getTime();
    const ends = new Date(plot.ends_at).getTime();
    const paused = Number(plot.total_paused_ms || 0);
    const totalMs = ends - started;
    let currentPaused = paused;
    if (plot.crow_active && plot.pause_started_at) {
        currentPaused += (now - new Date(plot.pause_started_at).getTime());
    }
    let progress = totalMs > 0 ? (now - started - currentPaused) / totalMs : 1;
    let fase = plot.fase;
    if (progress >= 1) { fase = 'ready'; progress = 1; }
    return { ...plot, progress, fase };
}

// GET /api/game/state
router.get('/state', async (req, res) => {
    try {
        const userId = req.userId;
        await ensureUserInitialized(userId);

        const configsRes = await db.execute('SELECT chave, valor FROM fazenda_config');
        const configsMap = configsRes.rows.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});

        await syncEnergy(userId, configsMap);

        const inventoryRes = await db.execute('SELECT item_id, quantidade FROM fazenda_inventario WHERE usuario_id = $1', [userId]);
        const inventory = inventoryRes.rows.reduce((acc, curr) => ({ ...acc, [curr.item_id]: curr.quantidade }), {});

        const slotsRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 ORDER BY slot_index', [userId]);
        const slots = slotsRes.rows.map(s => calculatePlotState(s, configsMap));

        const missionsRes = await db.execute(`
            SELECT m.*, t.label, t.tipo, t.target, t.reward_type, t.reward_amount
            FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id
            WHERE m.usuario_id = $1 AND m.expires_at > NOW()
        `, [userId]);

        const treeMetaRes = await db.execute('SELECT * FROM fazenda_arvore_meta WHERE data_dia = CURRENT_DATE');
        const treeMeta = treeMetaRes.rows[0] || null;
        if (treeMeta) treeMeta.reward_available = treeMeta.agua_atual >= treeMeta.meta_agua;

        res.json({ inventory, slots, missions: missionsRes.rows, configs: configsMap, worldTree: treeMeta });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game/action
router.post('/action', async (req, res) => {
    const { action, slotIndex, itemId, missionId } = req.body;
    const userId = req.userId;
    try {
        const inventoryRes = await db.execute('SELECT item_id, quantidade FROM fazenda_inventario WHERE usuario_id = $1', [userId]);
        const inventory = inventoryRes.rows.reduce((acc, curr) => ({ ...acc, [curr.item_id]: curr.quantidade }), {});

        if (action === 'buy_item') {
            const itemRes = await db.execute('SELECT * FROM fazenda_itens_config WHERE item_id = $1', [itemId]);
            if (!itemRes.rows.length) throw new Error('Item inválido');
            const item = itemRes.rows[0];
            const discount = parseInt((await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'global_discount'")).rows[0].valor || 0);

            if (item.price_diamonds > 0) {
                if ((inventory['diamante'] || 0) < item.price_diamonds) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [item.price_diamonds, userId]);
            } else {
                const price = Math.floor(item.price_coins * (1 - discount / 100));
                if ((inventory['coins'] || 0) < price) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [price, userId]);
            }
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, 1) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + 1", [userId, itemId]);
        }

        if (action === 'buy_pack') {
            if (itemId === 'pack_gold_1') {
                if ((inventory['diamante'] || 0) < 10) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - 10 WHERE usuario_id = $1 AND item_id = 'diamante'", [userId]);
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + 1000 WHERE usuario_id = $1 AND item_id = 'coins'", [userId]);
            } else if (itemId === 'pack_gold_2') {
                if ((inventory['diamante'] || 0) < 50) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - 50 WHERE usuario_id = $1 AND item_id = 'diamante'", [userId]);
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + 6000 WHERE usuario_id = $1 AND item_id = 'coins'", [userId]);
            }
        }

        if (action === 'use_item') {
            const itemRes = await db.execute('SELECT * FROM fazenda_itens_config WHERE item_id = $1', [itemId]);
            if (!itemRes.rows.length || (inventory[itemId] || 0) <= 0) throw new Error('Item esgotado');
            const item = itemRes.rows[0];
            let used = false;
            if (item.tipo === 'flower' || item.tipo === 'tree') {
                const endsAt = new Date(Date.now() + item.grow_hours * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'growing', crop_id = $1, started_at = NOW(), ends_at = $2, reward_base = $3, reward_actual = $4, crow_active = FALSE, pest_active = FALSE, total_paused_ms = 0 WHERE usuario_id = $5 AND slot_index = $6 AND fase = 'readyToPlant'", [itemId, endsAt, item.reward_base, item.reward_base, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'vasoPequeno' || itemId === 'vasoGrande') {
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'needsWater', pot_type = $1 WHERE usuario_id = $2 AND slot_index = $3 AND fase = 'needsPot'", [itemId, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'agua') {
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'readyToPlant' WHERE usuario_id = $1 AND slot_index = $2 AND (fase = 'needsWater' OR fase = 'readyToPlant')", [userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'espantalho') {
                const until = new Date(Date.now() + 7 * 24 * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET scarecrow_until = $1 WHERE usuario_id = $2 AND slot_index = $3", [until, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'pesticida') {
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET pest_active = FALSE WHERE usuario_id = $1 AND slot_index = $2 AND pest_active = TRUE", [userId, slotIndex]);
                used = updateRes.rowCount > 0;
            }
            if (used) await db.execute('UPDATE fazenda_inventario SET quantidade = quantidade - 1 WHERE usuario_id = $1 AND item_id = $2', [userId, itemId]);
            else throw new Error('Ação inválida para este slot');
        }

        if (action === 'harvest') {
            const slotRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
            const slot = calculatePlotState(slotRes.rows[0], {});
            if (slot.fase !== 'ready') throw new Error('Não está pronto');
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [Math.floor(slot.reward_actual), userId]);
            await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE WHERE id = $2", [slot.pot_type ? 'readyToPlant' : 'needsPot', slot.id]);
            await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'harvest_count')", [userId]);
        }

        if (action === 'claim_mission') {
            const resMission = await db.execute("SELECT m.*, t.reward_type, t.reward_amount FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id WHERE m.id = $1 AND m.usuario_id = $2 AND m.claimed = FALSE AND m.progress >= t.target", [missionId, userId]);
            if (!resMission.rows.length) throw new Error('Missão não disponível');
            await db.execute("UPDATE fazenda_missoes_jogador SET claimed = TRUE WHERE id = $1", [missionId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, resMission.rows[0].reward_type, resMission.rows[0].reward_amount]);
        }

        if (action === 'buy_slot') {
            const configsRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'slot_price_base'");
            const cost = parseInt(configsRes.rows[0].valor || 500);
            if ((inventory['coins'] || 0) < cost) throw new Error('Saldo insuficiente');
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [cost, userId]);
            await db.execute("UPDATE fazenda_plantacoes SET fase = 'needsPot' WHERE usuario_id = $1 AND slot_index = $2 AND fase = 'locked'", [userId, slotIndex]);
        }

        if (action === 'water_world_tree') {
            const today = new Date().toISOString().split('T')[0];
            const hour = new Date().getHours();
            const window6h = Math.floor(hour / 6);
            const contribRes = await db.execute(`
                INSERT INTO fazenda_arvore_contribuicoes (usuario_id, data_dia, janela_6h, quantidade)
                VALUES ($1, $2, $3, 1) ON CONFLICT (usuario_id, data_dia, janela_6h) DO UPDATE
                SET quantidade = fazenda_arvore_contribuicoes.quantidade + 1 WHERE fazenda_arvore_contribuicoes.quantidade < 2 RETURNING *
            `, [userId, today, window6h]);
            if (contribRes.rowCount === 0) throw new Error('Limite atingido (2 gotas a cada 6h)');
            await db.execute("UPDATE fazenda_arvore_meta SET agua_atual = agua_atual + 1 WHERE data_dia = $1", [today]);
        }

        if (action === 'collect_tree_reward') {
            const today = new Date().toISOString().split('T')[0];
            const metaRes = await db.execute("SELECT * FROM fazenda_arvore_meta WHERE data_dia = $1", [today]);
            if (!metaRes.rows.length || metaRes.rows[0].agua_atual < metaRes.rows[0].meta_agua) throw new Error('Meta da comunidade ainda não atingida');

            const contribRes = await db.execute("SELECT SUM(quantidade) as total, bool_or(recompensa_coletada) as coletada FROM fazenda_arvore_contribuicoes WHERE usuario_id = $1 AND data_dia = $2", [userId, today]);
            if (!contribRes.rows[0].total) throw new Error('Você não contribuiu hoje');
            if (contribRes.rows[0].coletada) throw new Error('Recompensa já coletada');

            await db.execute("UPDATE fazenda_arvore_contribuicoes SET recompensa_coletada = TRUE WHERE usuario_id = $1 AND data_dia = $2", [userId, today]);
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + 100 WHERE usuario_id = $1 AND item_id = 'coins'", [userId]); // Reward 100 gold
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
