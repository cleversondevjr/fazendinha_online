
function getCheckinDiaAtual(){

    const agora = new Date();

    const dataSP = new Intl.DateTimeFormat(
        "pt-BR",
        {
            timeZone:"America/Sao_Paulo",
            day:"2-digit",
            month:"2-digit",
            year:"numeric"
        }
    ).format(agora);

    const [dia,mes,ano] = dataSP.split("/");

    const inicio = new Date(
        `${ano}-${mes}-01T00:00:00-03:00`
    );

    const atual = new Date(
        `${ano}-${mes}-${dia}T00:00:00-03:00`
    );

    const numeroDia =
        Math.floor(
            (atual - inicio) / 86400000
        ) + 1;

    if(numeroDia >=1 && numeroDia<=28){
        return numeroDia;
    }

    return null;
}
const express = require('express');
const router = express.Router();
const db = require('../db');

const { ensureUserInitialized } = require('../utils/player_init');
const { isFeatureEnabled } = require('../utils/feature_check');

// --- Middleware: Maintenance Mode ---
router.use(async (req, res, next) => {
    try {
        const configsRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'maintenance_mode'");
        const isMaintenance = configsRes.rows[0]?.valor === 'true';

        if (isMaintenance) {
            const bypassRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'maintenance_bypass_ips'");
            const bypassList = JSON.parse(bypassRes.rows[0]?.valor || '[]');
            const clientIp = req.ip || req.headers['x-forwarded-for'];

            const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [req.userId]);
            const isAdmin = userRes.rows[0]?.is_admin;

            if (!isAdmin && !bypassList.includes(clientIp)) {
                return res.status(503).json({
                    maintenance: true,
                    message: "Servidor em manutenção para atualizações. Voltamos em breve!",});
            }
        }
        next();
    } catch (err) {
        next();
    }
});

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

    if (plot.pot_expires_at && new Date(plot.pot_expires_at).getTime() < now) {
        if (fase !== 'locked' && fase !== 'needsPot') {
            fase = 'needsPot';
        }
    }
    if (plot.water_expires_at && new Date(plot.water_expires_at).getTime() < now) {
        if (fase !== 'locked' && fase !== 'needsPot') {
            fase = 'needsWater';
        }
    }

    const isActuallyPaused = plot.crow_active || plot.pest_active || fase === 'needsPot' || fase === 'needsWater';

    if (isActuallyPaused && !pauseStartedAt) {
        pauseStartedAt = new Date();
    }

    if (fase !== 'growing' && fase !== 'ready') {
        return { ...plot, fase, pause_started_at: pauseStartedAt, progress: plot.progress || 0 };
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
        const inventory = inventoryRes.rows.reduce((acc, curr) => ({ ...acc, [curr.item_id]: BigInt(curr.quantidade).toString() }), {});

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

        const itemsRes = await db.execute('SELECT * FROM fazenda_itens_config ORDER BY tipo, item_id');

        const featuresRes = await db.execute('SELECT chave, ativa, data_lancamento, mensagem_bloqueio FROM fazenda_features');
        const featuresMap = featuresRes.rows.reduce((acc, f) => {
            const isReleased = f.ativa && new Date() >= new Date(f.data_lancamento);
            acc[f.chave] = { released: isReleased, message: f.mensagem_bloqueio };
            return acc;
        }, {});

        const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [userId]);
        const isAdmin = userRes.rows.length > 0 && !!userRes.rows[0].is_admin;


    res.json({
            isAdmin,
            inventory,
            slots,
            missions: missionsRes.rows,
            configs: configsMap,
            worldTree: treeMeta,
            items: itemsRes.rows,
            roadmap: featuresMap
        });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game/action
router.post('/action', async (req, res) => {
    const { action, slotIndex, itemId, missionId, quantity, price } = req.body;
    const qty = BigInt(quantity || 1);
    const userId = req.userId;
    try {
        const inventoryRes = await db.execute('SELECT item_id, quantidade FROM fazenda_inventario WHERE usuario_id = $1', [userId]);
        const inventory = inventoryRes.rows.reduce((acc, curr) => ({ ...acc, [curr.item_id]: BigInt(curr.quantidade) }), {});

        if (action === 'buy_item') {
            const itemRes = await db.execute('SELECT * FROM fazenda_itens_config WHERE item_id = $1', [itemId]);
            if (!itemRes.rows.length) throw new Error('Item inválido');
            const item = itemRes.rows[0];
            
            const discountRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'global_discount'");
            const discount = BigInt(discountRes.rows[0]?.valor || 0);

            if (BigInt(item.price_diamonds || 0) > 0n) {
                const totalDiamonds = BigInt(item.price_diamonds) * qty;
                const currentDiamonds = BigInt(inventory['diamante'] || 0);
                if (currentDiamonds < totalDiamonds) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [totalDiamonds.toString(), userId]);
            } else {
                const unitPrice = BigInt(item.price_coins || 0) * (100n - discount) / 100n;
                const totalCoins = unitPrice * qty;
                const currentCoins = BigInt(inventory['coins'] || 0);
                if (currentCoins < totalCoins) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [totalCoins.toString(), userId]);
            }
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, itemId, qty.toString()]);
        }

        if (action === 'use_item') {
            const itemRes = await db.execute('SELECT * FROM fazenda_itens_config WHERE item_id = $1', [itemId]);
            if (!itemRes.rows.length || (inventory[itemId] || 0n) <= 0n) throw new Error('Item esgotado');
            const item = itemRes.rows[0];
            let used = false;
            
            if (item.tipo === 'flower' || item.tipo === 'tree') {
                const configsRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'current_weather'");
                const weather = configsRes.rows[0]?.valor || 'sunny';

                let growHours = parseFloat(item.grow_hours);
                if (weather === 'rainy' && item.tipo === 'tree') growHours *= 0.8;
                if (weather === 'sunny' && item.tipo === 'flower') growHours *= 0.8;
                if (weather === 'windy') growHours *= 1.1;

                const endsAt = new Date(Date.now() + growHours * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'growing', crop_id = $1, started_at = NOW(), ends_at = $2, reward_base = $3, reward_actual = $4, crow_active = FALSE, pest_active = FALSE WHERE usuario_id = $5 AND slot_index = $6 AND (fase = 'readyToPlant' OR fase = 'needsWater')", [itemId, endsAt, item.reward_base, item.reward_base, userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (!used) throw new Error('Slot não está pronto para plantar. Coloque um vaso e regue primeiro.');
            } else if (itemId === 'vasoPequeno' || itemId === 'vasoGrande') {
                // Pot duration: vasoPequeno = 12h, vasoGrande = 24h
                const potHours = itemId === 'vasoGrande' ? 24 : 12;
                const potExpiresAt = new Date(Date.now() + potHours * 3600000);
                const slotRes = await db.execute('SELECT fase, water_expires_at FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
                if (!slotRes.rows.length) throw new Error('Slot não encontrado');
                const slot = slotRes.rows[0];
                if (slot.fase !== 'needsPot') throw new Error('Este slot já tem um vaso ou não precisa de um agora');
                const waterOk = slot.water_expires_at && new Date(slot.water_expires_at).getTime() > Date.now();
                const nextFase = waterOk ? 'readyToPlant' : 'needsWater';
                const updateRes = await db.execute(
                    "UPDATE fazenda_plantacoes SET pot_type = $1, pot_expires_at = $2, fase = $3 WHERE usuario_id = $4 AND slot_index = $5 AND fase = 'needsPot'",
                    [itemId, potExpiresAt, nextFase, userId, slotIndex]
                );
                used = updateRes.rowCount > 0;
                if (!used) throw new Error('Não foi possível usar o vaso neste slot');
            } else if (itemId === 'agua') {
                const slotRes = await db.execute('SELECT water_expires_at, fase FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
                if (!slotRes.rows.length) throw new Error('Slot não encontrado');
                const slot = slotRes.rows[0];
                if (slot.fase === 'locked') throw new Error('Slot bloqueado');
                let currentWaterEnd = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : Date.now();
                if (currentWaterEnd < Date.now()) currentWaterEnd = Date.now();
                const newExpiresAt = new Date(currentWaterEnd + 2 * 3600000);
                // Update water and if slot was needsWater with a pot, advance to readyToPlant
                const updateRes = await db.execute(
                    `UPDATE fazenda_plantacoes SET water_expires_at = $1,
                        fase = CASE WHEN fase = 'needsWater' AND pot_type IS NOT NULL THEN 'readyToPlant' ELSE fase END
                    WHERE usuario_id = $2 AND slot_index = $3`,
                    [newExpiresAt, userId, slotIndex]
                );
                used = updateRes.rowCount > 0;
                if (!used) throw new Error('Não foi possível regar este slot');
                // Update water mission progress
                await db.execute(`
                    UPDATE fazenda_missoes_jogador
                    SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                    WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                    AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'water_count')
                `, [userId]);
            } else if (itemId === 'pesticida') {
                const updateRes = await db.execute(
                    `UPDATE fazenda_plantacoes SET pest_active = FALSE,
                        total_paused_ms = total_paused_ms + CASE
                            WHEN pause_started_at IS NOT NULL AND crow_active = FALSE AND water_expires_at > NOW() AND (pot_expires_at IS NULL OR pot_expires_at > NOW())
                            THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000)
                            ELSE 0 END,
                        pause_started_at = CASE
                            WHEN crow_active = TRUE OR water_expires_at <= NOW() OR (pot_expires_at IS NOT NULL AND pot_expires_at <= NOW())
                            THEN COALESCE(pause_started_at, NOW())
                            ELSE NULL END
                    WHERE usuario_id = $1 AND slot_index = $2 AND pest_active = TRUE`,
                    [userId, slotIndex]
                );
                used = updateRes.rowCount > 0;
                if (!used) throw new Error('Não há pragas neste slot');
            } else if (itemId === 'espantalho') {
                const scarecrowHours = 6;
                const scarecrowUntil = new Date(Date.now() + scarecrowHours * 3600000);
                const updateRes = await db.execute(
                    "UPDATE fazenda_plantacoes SET scarecrow_until = $1 WHERE usuario_id = $2 AND slot_index = $3 AND fase != 'locked'",
                    [scarecrowUntil, userId, slotIndex]
                );
                used = updateRes.rowCount > 0;
                if (!used) throw new Error('Não foi possível colocar o espantalho neste slot');
            } else {
                throw new Error('Ação inválida para este item');
            }

            if (used) await db.execute('UPDATE fazenda_inventario SET quantidade = quantidade - 1 WHERE usuario_id = $1 AND item_id = $2', [userId, itemId]);
        }

        if (action === 'harvest') {
            const slotRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
            const slot = calculatePlotState(slotRes.rows[0], {});
            if (slot.fase !== 'ready') throw new Error('Não está pronto');
            
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [Math.floor(slot.reward_actual), userId]);

            // Decidir próximo estado: se tiver pote e ainda tiver água, vai para readyToPlant
            let nextFase = 'needsPot';
            if (slot.pot_type) {
                const waterExpires = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : 0;
                nextFase = (waterExpires > Date.now()) ? 'readyToPlant' : 'needsWater';
            }

            await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE usuario_id = $2 AND slot_index = $3", [nextFase, userId, slotIndex]);
            await db.execute("UPDATE fazenda_usuarios SET total_gold_generated = total_gold_generated + $1 WHERE id = $2", [Math.floor(slot.reward_actual), userId]);
            await db.execute(`
                UPDATE fazenda_missoes_jogador
                SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'harvest_count')
            `, [userId]);
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

                    let nextFase = 'needsPot';
                    if (slot.pot_type) {
                        const waterExpires = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : 0;
                        nextFase = (waterExpires > Date.now()) ? 'readyToPlant' : 'needsWater';
                    }

                    await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE id = $2", [nextFase, s.id]);
                }
            }

            if (harvestedCount > 0) {
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [totalReward, userId]);
                await db.execute("UPDATE fazenda_usuarios SET total_gold_generated = total_gold_generated + $1 WHERE id = $2", [totalReward, userId]);
                await db.execute(`
                    UPDATE fazenda_missoes_jogador
                    SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + $1)
                    WHERE usuario_id = $2 AND claimed = FALSE AND expires_at > NOW()
                    AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'harvest_count')
                `, [harvestedCount, userId]);
            } else {
                throw new Error('Nenhuma planta pronta para colher');
            }
        }

        if (action === 'claim_mission') {
            const resMission = await db.execute("SELECT m.*, t.reward_type, t.reward_amount FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id WHERE m.id = $1 AND m.usuario_id = $2", [missionId, userId]);
            if (!resMission.rows.length) throw new Error('Missão não disponível');
            await db.execute("UPDATE fazenda_missoes_jogador SET claimed = TRUE WHERE id = $1", [missionId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, resMission.rows[0].reward_type, resMission.rows[0].reward_amount]);        // XP do Passe: missão concluída = 34 XP.
        // 100 XP = 1 nível. As recompensas do Passe NÃO são entregues automaticamente.
        await db.execute(`
            INSERT INTO fazenda_season_pass_progresso
                (usuario_id, nivel_atual, xp_atual, claimed_levels)
            VALUES ($1, 0, 34, '{}')
            ON CONFLICT (usuario_id)
            DO UPDATE SET
                xp_atual = fazenda_season_pass_progresso.xp_atual + 34,
                updated_at = NOW()
        `, [userId]);

        const prog = (await db.execute(`
            SELECT * FROM fazenda_season_pass_progresso
            WHERE usuario_id = $1
        `, [userId])).rows[0];

        let nivelAtual = Number(prog.nivel_atual || 0);
        let xpAtual = Number(prog.xp_atual || 0);

        while (xpAtual >= 100 && nivelAtual < 30) {
            xpAtual -= 100;
            nivelAtual++;
        }

        await db.execute(`
            UPDATE fazenda_season_pass_progresso
            SET nivel_atual = $1,
                xp_atual = $2,
                updated_at = NOW()
            WHERE usuario_id = $3
        `, [nivelAtual, xpAtual, userId]);

        return res.json({
            success: true,
            xpGanho: 34,
            nivelAtual,
            xpAtual,
            xpNecessario: 100,
            nivelMaximo: 30
        });
        }

        if (action === 'claim_pass_reward') {
            const level = parseInt(missionId); // Reutilizando campo missionId para o nível do passe
            const progRes = await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId]);
            const prog = progRes.rows[0];
            if (!prog || prog.nivel_atual < level || prog.claimed_levels.includes(level)) throw new Error("Recompensa não disponível");

            const tier = (await db.execute("SELECT * FROM fazenda_season_pass_template WHERE nivel = $1", [level])).rows[0];
            if (!tier) throw new Error('Nível do passe não encontrado');
            await db.execute("UPDATE fazenda_season_pass_progresso SET claimed_levels = array_append(claimed_levels, $1) WHERE usuario_id = $2", [level, userId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, tier.recompensa_tipo, tier.recompensa_quantidade]);
        }

        if (action === 'buy_slot') {
            // Validar se slots premium (7 e 8, indices 6 e 7) estão liberados
            if (slotIndex >= 6) {
                const check = await isFeatureEnabled('SLOTS_PREMIUM');
                if (!check.ativa) throw new Error(check.mensagem);
            }

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
                if (BigInt(inventory['coins'] || 0) < BigInt(price.cost)) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [price.cost.toString(), userId]);
            } else {
                if (BigInt(inventory['diamante'] || 0) < BigInt(price.cost)) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [price.cost.toString(), userId]);
            }

            const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'needsPot' WHERE usuario_id = $1 AND slot_index = $2 AND fase = 'locked'", [userId, slotIndex]);
            if (updateRes.rowCount > 0) {
                await db.execute(`
                    UPDATE fazenda_missoes_jogador
                    SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                    WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                    AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'unlock_slot')
                `, [userId]);
            }
        }

        if (action === 'remove_crow') {
            const updateRes = await db.execute(`
                UPDATE fazenda_plantacoes
                SET crow_active = FALSE,
                    total_paused_ms = total_paused_ms + CASE
                        WHEN pause_started_at IS NOT NULL AND pest_active = FALSE AND water_expires_at > NOW() AND (pot_expires_at IS NULL OR pot_expires_at > NOW())
                        THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000)
                        ELSE 0 END,
                    pause_started_at = CASE
                        WHEN pest_active = TRUE OR water_expires_at <= NOW() OR (pot_expires_at IS NOT NULL AND pot_expires_at <= NOW())
                        THEN COALESCE(pause_started_at, NOW())
                        ELSE NULL END
                WHERE usuario_id = $1 AND slot_index = $2 AND crow_active = TRUE
            `, [userId, slotIndex]);
            if (updateRes.rowCount > 0) {
                await db.execute(`
                    UPDATE fazenda_missoes_jogador
                    SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                    WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                    AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'remove_crow')
                `, [userId]);
            }
        }

        if (action === 'remove_plant') {
            const slotRes = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
            if (!slotRes.rows.length) throw new Error('Slot não encontrado');
            const slot = slotRes.rows[0];
            if (slot.fase === 'locked' || slot.fase === 'needsPot') throw new Error('Slot já está vazio');

            let nextFase = 'needsPot';
            if (slot.pot_type) {
                const waterExpires = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : 0;
                nextFase = (waterExpires > Date.now()) ? 'readyToPlant' : 'needsWater';
            }

            await db.execute(`
                UPDATE fazenda_plantacoes
                SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL,
                    crow_active = FALSE, pest_active = FALSE, reward_actual = 0
                WHERE usuario_id = $2 AND slot_index = $3
            `, [nextFase, userId, slotIndex]);
        }

        if (action === 'marketplace_list') {
            const check = await isFeatureEnabled('MARKETPLACE');
            if (!check.ativa) throw new Error(check.mensagem);
            if ((inventory[itemId] || 0n) < qty) throw new Error('Quantidade insuficiente no inventário');

            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = $3", [qty.toString(), userId, itemId]);
            await db.execute("INSERT INTO fazenda_marketplace (vendedor_id, item_id, quantidade, preco_diamante, status) VALUES ($1, $2, $3, $4, 'listing')", [userId, itemId, qty.toString(), BigInt(price).toString()]);
        }

        if (action === 'marketplace_buy') {
            const marketRes = await db.execute("SELECT * FROM fazenda_marketplace WHERE id = $1 AND status = 'listing'", [itemId]);
            if (!marketRes.rows.length) throw new Error('Item não disponível ou já vendido');
            const entry = marketRes.rows[0];
            const totalCost = BigInt(entry.preco_diamante);

            if ((inventory['diamante'] || 0n) < totalCost) throw new Error('Diamantes insuficientes');

            const burnAmount = totalCost / 10n;
            const sellerGain = totalCost - burnAmount;

            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [totalCost.toString(), userId]);
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [sellerGain.toString(), entry.vendedor_id]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, entry.item_id, entry.quantidade]);
            await db.execute("UPDATE fazenda_marketplace SET status = 'sold', updated_at = NOW() WHERE id = $1", [itemId]);
        }

        if (action === 'water_world_tree') {
            // Allow up to 2 contributions per user per day (tracked via config key per user)
            const today = new Date().toISOString().slice(0, 10);
            const contribKey = `tree_contrib_${userId}_${today}`;
            const contribRes = await db.execute("SELECT valor FROM fazenda_config WHERE chave = $1", [contribKey]);
            const contributed = parseInt(contribRes.rows[0]?.valor || '0');
            if (contributed >= 2) throw new Error('Você já contribuiu 2 vezes hoje para a Árvore Mundial');
            await db.execute(
                "INSERT INTO fazenda_config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = (CAST(fazenda_config.valor AS INTEGER) + 1)::TEXT, updated_at = NOW()",
                [contribKey, '1']
            );
            await db.execute(
                "UPDATE fazenda_arvore_meta SET agua_atual = agua_atual + 1 WHERE data_dia = CURRENT_DATE"
            );
        }

        if (action === 'collect_tree_reward') {
            const today = new Date().toISOString().slice(0, 10);
            const rewardKey = `tree_reward_${userId}_${today}`;
            const alreadyClaimed = (await db.execute("SELECT valor FROM fazenda_config WHERE chave = $1", [rewardKey])).rows[0];
            if (alreadyClaimed) throw new Error('Você já coletou a recompensa da Árvore hoje');
            const treeMeta = (await db.execute("SELECT * FROM fazenda_arvore_meta WHERE data_dia = CURRENT_DATE")).rows[0];
            if (!treeMeta || treeMeta.agua_atual < treeMeta.meta_agua) throw new Error('Meta da Árvore ainda não atingida');
            await db.execute(
                "INSERT INTO fazenda_config (chave, valor) VALUES ($1, 'true') ON CONFLICT (chave) DO NOTHING",
                [rewardKey]
            );
            await db.execute(
                "UPDATE fazenda_inventario SET quantidade = quantidade + 100 WHERE usuario_id = $1 AND item_id = 'coins'",
                [userId]
            );
        }

        if (action === 'buy_pack') {
            // Gold packs purchasable with diamonds
            const packs = {
                'pack_gold_1': { cost: 10, reward: 1000 },
                'pack_gold_2': { cost: 50, reward: 6000 }
            };
            const pack = packs[itemId];
            if (!pack) throw new Error('Pacote inválido');
            const costBig = BigInt(pack.cost);
            if ((inventory['diamante'] || 0n) < costBig) throw new Error('Diamantes insuficientes');
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [pack.cost.toString(), userId]);
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'coins'", [pack.reward.toString(), userId]);
        }



    res.json({ success: true });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/game/season-pass
router.get('/season-pass', async (req, res) => {
    const userId = req.userId;
    try {
        const progRes = await db.execute(
            "SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1",
            [userId]
        );
        let prog = progRes.rows[0];
        if (!prog) {
            await db.execute(
                "INSERT INTO fazenda_season_pass_progresso (usuario_id, nivel_atual, xp_atual, claimed_levels) VALUES ($1, 0, 0, '{}') ON CONFLICT DO NOTHING",
                [userId]
            );
            prog = { nivel_atual: 0, xp_atual: 0, claimed_levels: [] };
        }

        const tiersRes = await db.execute(
            "SELECT * FROM fazenda_season_pass_template ORDER BY nivel ASC"
        );



    res.json({
            progress: prog,
            tiers: tiersRes.rows
        });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/game/marketplace
router.get('/marketplace', async (req, res) => {
    const userId = req.userId;
    try {
        const check = await isFeatureEnabled('MARKETPLACE');
        if (!check.ativa) return res.json({ items: [], locked: true, message: check.mensagem });

        const itemsRes = await db.execute(`
            SELECT m.id, m.item_id, m.quantidade, m.preco_diamante, u.login as vendedor
            FROM fazenda_marketplace m
            JOIN fazenda_usuarios u ON m.vendedor_id = u.id
            WHERE m.status = 'listing' AND m.vendedor_id != $1
            ORDER BY m.created_at DESC
            LIMIT 50
        `, [userId]);



    res.json({ items: itemsRes.rows });
    } catch (err) {
        console.error('[GAME ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/game/checkin
router.post('/checkin', async (req, res) => {
    const userId = req.userId;
    const diaSolicitado = Number(req.body?.dia);

    try {
        const check = await isFeatureEnabled('CHECKIN_DIARIO');

        if (!check.ativa) {
            throw new Error(check.mensagem || 'Check-in diário ainda não disponível');
        }

        let progresso = await db.execute(
            "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
            [userId]
        );

        if (!progresso.rows.length) {
            await db.execute(
                `INSERT INTO fazenda_checkin_progresso
                    (usuario_id,dia_atual,ciclo,ultima_data,recompensas_coletadas)
                 VALUES($1,0,1,NULL,'[]'::jsonb)`,
                [userId]
            );

            progresso = await db.execute(
                "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
                [userId]
            );
        }

        const dados = progresso.rows[0];

        const coletadas = Array.isArray(dados.recompensas_coletadas)
            ? dados.recompensas_coletadas.map(Number)
            : [];

        const tipo = req.body?.tipo;

    const semanas = {
        1: [1,2,3,4,5,6,7],
        2: [8,9,10,11,12,13,14],
        3: [15,16,17,18,19,20,21],
        4: [22,23,24,25,26,27,28]
    };

    const semanasCompletas = {
        1: semanas[1].every(d => coletadas.includes(d)),
        2: semanas[2].every(d => coletadas.includes(d)),
        3: semanas[3].every(d => coletadas.includes(d)),
        4: semanas[4].every(d => coletadas.includes(d))
    };

    const bonusMensalCompleto =
        semanasCompletas[1] &&
        semanasCompletas[2] &&
        semanasCompletas[3] &&
        semanasCompletas[4];

    if (tipo === 'bonus_semanal') {
        const semana = Number(req.body?.semana);

        if (!Number.isInteger(semana) || semana < 1 || semana > 4) {
            throw new Error('Bônus semanal inválido.');
        }

        if (!semanasCompletas[semana]) {
            throw new Error(`O bônus da Semana ${semana} ainda não está liberado.`);
        }

        const coluna = `bonus_semana_${semana}`;

        if (dados[coluna]) {
            throw new Error(`O bônus da Semana ${semana} já foi coletado.`);
        }

        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'diamante', 50) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + 50", [userId]);
        await db.execute(
            `UPDATE fazenda_checkin_progresso
             SET ${coluna}=TRUE,
                 updated_at=NOW()
             WHERE usuario_id=$1`,
            [userId]
        );

        return res.json({
            success: true,
            tipo: 'bonus_semanal',
            semana,
            message: `Bônus da Semana ${semana} coletado!`
        });
    }

    if (tipo === 'bonus_mensal') {
        if (!bonusMensalCompleto) {
            throw new Error('O bônus mensal ainda não está liberado.');
        }

        if (dados.bonus_mensal) {
            throw new Error('O bônus mensal já foi coletado.');
        }

        await db.execute(
            `UPDATE fazenda_checkin_progresso
             SET bonus_mensal=TRUE,
                 updated_at=NOW()
             WHERE usuario_id=$1`,
            [userId]
        );

        return res.json({
            success: true,
            tipo: 'bonus_mensal',
            message: 'Bônus mensal coletado!'
        });
    }
    const diaAtual = getCheckinDiaAtual();

    if (!diaAtual) {
        throw new Error('Check-in encerrado neste período.');
    }

    if (!Number.isInteger(diaSolicitado) || diaSolicitado < 1 || diaSolicitado > 28) {
        throw new Error('Dia de check-in inválido.');
    }

    if (diaSolicitado > diaAtual) {
        throw new Error('Este dia ainda não está disponível.');
    }

    if (coletadas.includes(diaSolicitado)) {
            throw new Error(`O Dia ${diaSolicitado} já foi coletado.`);
        }
    const recompensa = await db.execute(
            "SELECT * FROM fazenda_checkin_recompensas WHERE dia=$1",
            [diaSolicitado]
        );

        if (!recompensa.rows.length) {
            throw new Error('Recompensa não encontrada.');
        }

        const r = recompensa.rows[0];

        /*
         * Recompensas normais:
         * coins, energia e diamante entram no inventário.
         */
        if (r.tipo_recompensa !== 'bonus' && r.item_id) {
            await db.execute(
                `INSERT INTO fazenda_inventario
                    (usuario_id,item_id,quantidade)
                 VALUES($1,$2,$3)
                 ON CONFLICT(usuario_id,item_id)
                 DO UPDATE SET quantidade =
                    fazenda_inventario.quantidade + $3`,
                [userId, r.item_id, r.quantidade]
            );
        }

            /*
     * Registra a recompensa coletada.
     * Os bônus semanais são liberados quando TODOS os dias
     * daquela semana estiverem coletados, independente da ordem.
     */

const novasColetadas = [...new Set([...coletadas, diaSolicitado])];

const semana1CompletaAposColeta = [1,2,3,4,5,6,7].every(d => novasColetadas.includes(d));

const semana2CompletaAposColeta = [8,9,10,11,12,13,14].every(d => novasColetadas.includes(d));

const semana3CompletaAposColeta = [15,16,17,18,19,20,21].every(d => novasColetadas.includes(d));

const semana4CompletaAposColeta = [22,23,24,25,26,27,28].every(d => novasColetadas.includes(d));

const bonusMensalCompletoAposColeta = semana1CompletaAposColeta && semana2CompletaAposColeta && semana3CompletaAposColeta && semana4CompletaAposColeta;


const bonusLiberados = {
    semana1: semana1CompletaAposColeta && !dados.bonus_semana_1,
    semana2: semana2CompletaAposColeta && !dados.bonus_semana_2,
    semana3: semana3CompletaAposColeta && !dados.bonus_semana_3,
    semana4: semana4CompletaAposColeta && !dados.bonus_semana_4,
    mensal: bonusMensalCompletoAposColeta && !dados.bonus_mensal
};

    await db.execute(
        `UPDATE fazenda_checkin_progresso
         SET dia_atual=GREATEST(COALESCE(dia_atual,0),$1),
             ultima_data=CURRENT_DATE,
             recompensas_coletadas=
                COALESCE(recompensas_coletadas,'[]'::jsonb)
                || jsonb_build_array($1),
             updated_at=NOW()
         WHERE usuario_id=$2`,
        [
        diaSolicitado,
        userId
    ]
    );    res.json({
        success: true,
        dia: diaSolicitado,
        totalDias: 28,
        recompensa: r,
        message: r.tipo_recompensa === 'bonus'
            ? `${r.titulo} coletado!`
            : `Recompensa do Dia ${diaSolicitado} coletada!`,
        bonusLiberados
    });

    } catch (err) {
        console.error('[CHECKIN ERROR]', err);

        res.status(500).json({
            error: err.message
        });
    }
});
router.get('/checkin', async (req,res)=>{

    const userId=req.userId;

    try{

        const progresso=await db.execute(
            "SELECT * FROM fazenda_checkin_progresso WHERE usuario_id=$1",
            [userId]
        );

        const recompensas=await db.execute(
            "SELECT * FROM fazenda_checkin_recompensas ORDER BY dia"
        );

        const diaReal = getCheckinDiaAtual();

const dadosProgresso = progresso.rows[0] || {
        dia_atual:0,
        ciclo:1,
        recompensas_coletadas:[]
    };

    dadosProgresso.recompensas_coletadas = dadosProgresso.recompensas_coletadas || [];

    const diaJogo = diaReal || 0;
    dadosProgresso.dia_atual = diaJogo;
    const coletados = dadosProgresso.recompensas_coletadas || [];

    const diasStatus = recompensas.rows.map(r => ({
        ...r,
        status:
            coletados.includes(r.dia)
                ? "collected"
                : r.dia === diaJogo
                    ? "available"
                    : r.dia < diaJogo
                        ? "missed"
                        : "locked"
    }));



const bonusSemanais = [
    { semana: 1, liberado: [1,2,3,4,5,6,7].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_1, coletado: !!dadosProgresso.bonus_semana_1 },
    { semana: 2, liberado: [8,9,10,11,12,13,14].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_2, coletado: !!dadosProgresso.bonus_semana_2 },
    { semana: 3, liberado: [15,16,17,18,19,20,21].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_3, coletado: !!dadosProgresso.bonus_semana_3 },
    { semana: 4, liberado: [22,23,24,25,26,27,28].every(d => coletados.includes(d)) && !dadosProgresso.bonus_semana_4, coletado: !!dadosProgresso.bonus_semana_4 }
];

const bonusMensal = {
    liberado: Array.from({ length: 28 }, (_, i) => i + 1).every(d => coletados.includes(d)) && !dadosProgresso.bonus_mensal,
    coletado: !!dadosProgresso.bonus_mensal
};
res.json({
    bonusSemanais,
    bonusMensal,
        progresso: dadosProgresso,
        recompensas: diasStatus,
    });

    }catch(err){

        res.status(500).json({
            error:err.message
        });

    }

});

module.exports = router;




































































