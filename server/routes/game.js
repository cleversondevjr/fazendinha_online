const express = require('express');
const router = express.Router();
const db = require('../db');

// --- Helpers for Missions ---
function weightedRandomSelect(items, n) {
    if (!items.length) return [];
    const pool = [];
    items.forEach(item => { for (let i = 0; i < item.weight; i++) pool.push(item); });
    const selected = [];
    const poolCopy = [...pool];
    for (let i = 0; i < n; i++) {
        if (!poolCopy.length) break;
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        const picked = poolCopy[randomIndex];
        selected.push(picked);
        // Remove all instances of the same mission to avoid duplicates in the same batch
        for (let j = poolCopy.length - 1; j >= 0; j--) {
            if (poolCopy[j].id === picked.id) poolCopy.splice(j, 1);
        }
    }
    return selected;
}

async function assignInitialMissions(userId) {
    const templatesRes = await db.execute('SELECT * FROM fazenda_missoes_template WHERE active = TRUE');
    if (templatesRes.rows.length === 0) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    const selected = weightedRandomSelect(templatesRes.rows, 5);
    for (const mission of selected) {
        await db.execute('INSERT INTO fazenda_missoes_jogador (usuario_id, template_id, expires_at) VALUES ($1, $2, $3)', [userId, mission.id, expiresAt]);
    }
}

// --- Helper: Initialize User Data ---
async function ensureUserInitialized(userId) {
    const slots = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1', [userId]);
    if (slots.rows.length === 0) {
        for (let i = 0; i < 8; i++) {
            // Todos iniciam como locked
            await db.execute('INSERT INTO fazenda_plantacoes (usuario_id, slot_index, fase) VALUES ($1, $2, $3)', [userId, i, 'locked']);
        }
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', 1000), ($1, 'energia', 100)", [userId]);
        await db.execute("INSERT INTO fazenda_config (chave, valor) VALUES ('last_energy_sync_' || $1, NOW()::text) ON CONFLICT (chave) DO NOTHING", [userId]);

        // Atribuir missões iniciais imediatamente
        await assignInitialMissions(userId);
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
    const now = Date.now();
    let fase = plot.fase;
    let pauseStartedAt = plot.pause_started_at;

    // 1. Verificar se o pote expirou
    if (plot.pot_expires_at && new Date(plot.pot_expires_at).getTime() < now) {
        if (fase !== 'locked' && fase !== 'needsPot') {
            fase = 'needsPot';
        }
    }
    // 2. Verificar se a água expirou
    if (plot.water_expires_at && new Date(plot.water_expires_at).getTime() < now) {
        if (fase === 'readyToPlant' || fase === 'growing' || fase === 'ready') {
            fase = 'needsWater';
        }
    }

    const isActuallyPaused = plot.crow_active || fase === 'needsPot' || fase === 'needsWater';

    if (plot.fase === 'growing' && isActuallyPaused && !pauseStartedAt) {
        pauseStartedAt = new Date();
    }

    if (fase !== 'growing' && fase !== 'ready') {
        return { ...plot, fase, pause_started_at: pauseStartedAt };
    }

    const started = new Date(plot.started_at).getTime();
    const ends = new Date(plot.ends_at).getTime();
    const paused = Number(plot.total_paused_ms || 0);
    const totalMs = ends - started;
    let currentPaused = paused;

    if (isActuallyPaused && pauseStartedAt) {
        currentPaused += (now - new Date(pauseStartedAt).getTime());
    }

    let progress = totalMs > 0 ? (now - started - currentPaused) / totalMs : 1;
    if (progress >= 1) { fase = 'ready'; progress = 1; }
    return { ...plot, progress, fase, pause_started_at: pauseStartedAt };
}

// GET /api/game/state
router.get('/state', async (req, res) => {
    try {
        const userId = req.userId;
        await ensureUserInitialized(userId);

        const configsRes = await db.execute('SELECT chave, valor FROM fazenda_config');
        const configsMap = configsRes.rows.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});

        if (!configsMap.max_energy) configsMap.max_energy = '100';
        if (!configsMap.energy_restore_per_hour) configsMap.energy_restore_per_hour = '5';
        if (!configsMap.slot_price_base) configsMap.slot_price_base = '500';
        if (!configsMap.global_discount) configsMap.global_discount = '0';

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
        if (treeMeta) {
            treeMeta.reward_available = treeMeta.agua_atual >= treeMeta.meta_agua;
        } else {
            const dailyMeta = 100;
            await db.execute('INSERT INTO fazenda_arvore_meta (data_dia, meta_agua) VALUES (CURRENT_DATE, $1) ON CONFLICT DO NOTHING', [dailyMeta]);
        }

        res.json({ inventory, slots, missions: missionsRes.rows, configs: configsMap, worldTree: treeMeta });
    } catch (err) {
        console.error("State Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game/action
router.post('/action', async (req, res) => {
    const { action, slotIndex, itemId, missionId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;
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
                const totalDiamonds = item.price_diamonds * qty;
                if ((inventory['diamante'] || 0) < totalDiamonds) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [totalDiamonds, userId]);
            } else {
                const unitPrice = Math.floor(item.price_coins * (1 - discount / 100));
                const totalCoins = unitPrice * qty;
                if ((inventory['coins'] || 0) < totalCoins) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [totalCoins, userId]);
            }
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, itemId, qty]);
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
                const configsRes = await db.execute("SELECT chave, valor FROM fazenda_config WHERE chave = 'current_weather'");
                const weather = configsRes.rows[0]?.valor || 'sunny';

                let growHours = parseFloat(item.grow_hours);
                if (weather === 'rainy' && item.tipo === 'tree') growHours *= 0.8;
                if (weather === 'sunny' && item.tipo === 'flower') growHours *= 0.8;
                if (weather === 'windy') growHours *= 1.1;

                const endsAt = new Date(Date.now() + growHours * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'growing', crop_id = $1, started_at = NOW(), ends_at = $2, reward_base = $3, reward_actual = $4, crow_active = FALSE, pest_active = FALSE, total_paused_ms = 0 WHERE usuario_id = $5 AND slot_index = $6 AND fase = 'readyToPlant'", [itemId, endsAt, item.reward_base, item.reward_base, userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (used) {
                    const missionType = item.tipo === 'flower' ? 'plant_flowers' : 'plant_trees';
                    await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = $2)", [userId, missionType]);
                }
            } else if (itemId === 'vasoPequeno' || itemId === 'vasoGrande') {
                // Restrição: Vaso Grande apenas nos slots 1 e 5 (index 0 e 4)
                if (itemId === 'vasoGrande' && slotIndex !== 0 && slotIndex !== 4) {
                    throw new Error('Vaso Grande só pode ser usado nos Slots 1 e 5');
                }

                const potHours = parseInt((await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'pot_duration_hours'")).rows[0]?.valor || 168);
                const expiresAt = new Date(Date.now() + potHours * 3600000);
                const updateRes = await db.execute(`
                    UPDATE fazenda_plantacoes
                    SET fase = 'needsWater', pot_type = $1, pot_expires_at = $2,
                        total_paused_ms = total_paused_ms + CASE WHEN pause_started_at IS NOT NULL THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000) ELSE 0 END,
                        pause_started_at = NULL
                    WHERE usuario_id = $3 AND slot_index = $4 AND (fase = 'needsPot' OR fase = 'growing')
                `, [itemId, expiresAt, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'agua') {
                const maxWater = (slotIndex >= 6) ? 4 : 2;
                const slotRes = await db.execute('SELECT water_expires_at, fase FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
                const slot = slotRes.rows[0];

                let currentWaterEnd = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : Date.now();
                if (currentWaterEnd < Date.now()) currentWaterEnd = Date.now();

                const waterDurationMs = 2 * 3600000; // 2 horas cada água
                const newExpiresAt = new Date(currentWaterEnd + waterDurationMs);

                // Validar limite de águas (empilhamento de tempo)
                if (newExpiresAt.getTime() > Date.now() + maxWater * waterDurationMs) {
                    throw new Error(`Limite de água atingido para este slot (Máx ${maxWater} águas)`);
                }

                const updateRes = await db.execute(`
                    UPDATE fazenda_plantacoes
                    SET fase = CASE WHEN crop_id IS NOT NULL THEN 'growing' ELSE 'readyToPlant' END,
                        water_expires_at = $1,
                        total_paused_ms = total_paused_ms + CASE WHEN pause_started_at IS NOT NULL AND crow_active = FALSE THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000) ELSE 0 END,
                        pause_started_at = CASE WHEN crow_active = TRUE THEN NOW() ELSE NULL END
                    WHERE usuario_id = $2 AND slot_index = $3 AND (fase = 'needsWater' OR fase = 'readyToPlant' OR fase = 'growing')
                `, [newExpiresAt, userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (used) {
                    await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'water_slots')", [userId]);
                }
            } else if (itemId === 'espantalho') {
                const until = new Date(Date.now() + 7 * 24 * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET scarecrow_until = $1 WHERE usuario_id = $2 AND slot_index = $3", [until, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'pesticida') {
                console.log(`User ${userId} using pesticide on slot ${slotIndex}`);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET pest_active = FALSE WHERE usuario_id = $1 AND slot_index = $2", [userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (used) {
                    await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'use_pesticide')", [userId]);
                }
            }
            if (used) await db.execute('UPDATE fazenda_inventario SET quantidade = quantidade - 1 WHERE usuario_id = $1 AND item_id = $2', [userId, itemId]);
            else throw new Error('Ação inválida para este slot');
        }

        if (action === 'harvest') {
            const slotRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
            const slot = calculatePlotState(slotRes.rows[0], {});
            if (slot.fase !== 'ready') throw new Error('Não está pronto');
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [Math.floor(slot.reward_actual), userId]);
            await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE id = $2", [slot.pot_type ? 'readyToPlant' : 'needsPot', slot.id]);
            await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'harvest_count')", [userId]);
        }

        if (action === 'harvest_all') {
            const slotsRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1', [userId]);
            let totalReward = 0;
            let harvestedCount = 0;

            for (const s of slotsRes.rows) {
                const slot = calculatePlotState(s, {});
                if (slot.fase === 'ready') {
                    totalReward += Math.floor(slot.reward_actual);
                    harvestedCount++;
                    await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE id = $2", [slot.pot_type ? 'readyToPlant' : 'needsPot', slot.id]);
                }
            }

            if (harvestedCount > 0) {
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [totalReward, userId]);
                await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + $1) WHERE usuario_id = $2 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'harvest_count')", [harvestedCount, userId]);
            } else {
                throw new Error('Nenhuma planta pronta para colher');
            }
        }

        if (action === 'claim_mission') {
            const resMission = await db.execute("SELECT m.*, t.reward_type, t.reward_amount FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id WHERE m.id = $1 AND m.usuario_id = $2 AND m.claimed = FALSE AND m.progress >= t.target", [missionId, userId]);
            if (!resMission.rows.length) throw new Error('Missão não disponível');
            await db.execute("UPDATE fazenda_missoes_jogador SET claimed = TRUE WHERE id = $1", [missionId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, resMission.rows[0].reward_type, resMission.rows[0].reward_amount]);
        }

        if (action === 'buy_slot') {
            const slotPrices = [
                { type: 'gold', cost: 100 },
                { type: 'gold', cost: 500 },
                { type: 'gold', cost: 1000 },
                { type: 'gold', cost: 2500 },
                { type: 'gold', cost: 5000 },
                { type: 'gold', cost: 10000 },
                { type: 'diamond', cost: 1000 },
                { type: 'diamond', cost: 4000 }
            ];

            const price = slotPrices[slotIndex];
            if (!price) throw new Error('Slot inválido');

            // Regra: Slots de ouro (0-5) devem ser comprados em ordem
            if (price.type === 'gold' && slotIndex > 0) {
                const goldSlotsRes = await db.execute('SELECT slot_index, fase FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index < $2 ORDER BY slot_index ASC', [userId, slotIndex]);
                const prevGoldSlots = goldSlotsRes.rows.filter(s => slotPrices[s.slot_index].type === 'gold');

                for (const s of prevGoldSlots) {
                    if (s.fase === 'locked') {
                        throw new Error(`Você deve comprar o Slot ${s.slot_index + 1} de ouro primeiro`);
                    }
                }
            }

            if (price.type === 'gold') {
                if ((inventory['coins'] || 0) < price.cost) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [price.cost, userId]);
            } else {
                if ((inventory['diamante'] || 0) < price.cost) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [price.cost, userId]);
            }

            const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'needsPot' WHERE usuario_id = $1 AND slot_index = $2 AND fase = 'locked'", [userId, slotIndex]);
            if (updateRes.rowCount > 0) {
                await db.execute("UPDATE fazenda_missoes_jogador SET progress = LEAST(target, progress + 1) WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW() AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'unlock_slot')", [userId]);
            }
        }

        if (action === 'remove_plant') {
            const slotRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
            if (!slotRes.rows.length) throw new Error('Slot não encontrado');
            const slot = slotRes.rows[0];
            if (slot.fase === 'locked' || slot.fase === 'needsPot') throw new Error('Slot já está vazio');

            await db.execute(`
                UPDATE fazenda_plantacoes
                SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL,
                    crow_active = FALSE, pest_active = FALSE, reward_actual = 0
                WHERE id = $2
            `, [slot.pot_type ? 'readyToPlant' : 'needsPot', slot.id]);
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
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + 100 WHERE usuario_id = $1 AND item_id = 'coins'", [userId]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
