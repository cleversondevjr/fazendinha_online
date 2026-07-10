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

            // Permitir Admin e IPs na whitelist
            const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [req.userId]);
            const isAdmin = userRes.rows[0]?.is_admin;

            if (!isAdmin && !bypassList.includes(clientIp)) {
                return res.status(503).json({
                    maintenance: true,
                    message: "Servidor em manutenção para atualizações. Voltamos em breve!"
                });
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

    // 1. Verificar se o pote expirou
    if (plot.pot_expires_at && new Date(plot.pot_expires_at).getTime() < now) {
        if (fase !== 'locked' && fase !== 'needsPot') {
            fase = 'needsPot';
        }
    }
    // 2. Verificar se a água expirou
    if (plot.water_expires_at && new Date(plot.water_expires_at).getTime() < now) {
        // Se a água expirou, o slot deve estar no estado needsWater, exceto se já estiver bloqueado ou sem pote
        if (fase !== 'locked' && fase !== 'needsPot') {
            fase = 'needsWater';
        }
    }

    // Corvos e Pragas também pausam o crescimento no PvU 2021
    const isActuallyPaused = plot.crow_active || plot.pest_active || fase === 'needsPot' || fase === 'needsWater';

    // Se mudou para um estado de pausa e ainda não registramos o início da pausa
    if (isActuallyPaused && !pauseStartedAt) {
        pauseStartedAt = new Date();
    } else if (!isActuallyPaused && pauseStartedAt) {
        // Se saiu do estado de pausa, o tempo pausado será somado no cálculo abaixo ou na próxima ação de escrita
        // No GET state apenas visualizamos, não alteramos o banco
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

        // Adiciona catálogo de itens público para o frontend
        const itemsRes = await db.execute('SELECT * FROM fazenda_itens_config ORDER BY tipo, item_id');

        // Feature Flags para o Roadmap
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
        console.error("State Error:", err);
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

        if (action === 'buy_pack') {
            // Regra: 10.000 Ouro = 10 Diamantes. Limite de 1 troca por dia/conta.
            if (itemId.startsWith('conv_diamante_')) {
                const today = new Date().toISOString().split('T')[0];
                const limitCheck = await db.execute("SELECT id FROM fazenda_audit_logs WHERE usuario_id = $1 AND acao = 'conversion_gold' AND created_at::date = $2", [userId, today]);
                if (limitCheck.rows.length >= 1) throw new Error('Limite de 1 conversão por dia atingido');

                const goldCost = 10000n;
                const diamondGain = 10n;

                if ((inventory['coins'] || 0n) < goldCost) throw new Error('Ouro insuficiente');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'coins'", [goldCost.toString(), userId]);
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [diamondGain.toString(), userId]);

                await db.execute("INSERT INTO fazenda_audit_logs (usuario_id, acao, valor_novo) VALUES ($1, 'conversion_gold', $2)", [userId, { gold: goldCost.toString(), diamond: diamondGain.toString() }]);
            } else if (itemId.startsWith('pack_diamante_')) {
                // Placeholder para bônus de pacotes reais
                const diamondBase = BigInt(itemId.split('_').pop()) * 1000n; // Simulação
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [diamondBase.toString(), userId]);
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
                    await db.execute(`
                        UPDATE fazenda_missoes_jogador
                        SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                        WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                        AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = $2)
                    `, [userId, missionType]);
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
                    SET fase = CASE WHEN water_expires_at > NOW() THEN (CASE WHEN crop_id IS NOT NULL THEN 'growing' ELSE 'readyToPlant' END) ELSE 'needsWater' END,
                        pot_type = $1, pot_expires_at = $2,
                        total_paused_ms = total_paused_ms + CASE
                            WHEN pause_started_at IS NOT NULL AND water_expires_at > NOW() AND crow_active = FALSE AND pest_active = FALSE
                            THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000)
                            ELSE 0 END,
                        pause_started_at = CASE
                            WHEN water_expires_at <= NOW() OR crow_active = TRUE OR pest_active = TRUE
                            THEN COALESCE(pause_started_at, NOW())
                            ELSE NULL END
                    WHERE usuario_id = $3 AND slot_index = $4 AND (fase = 'needsPot' OR fase = 'growing' OR fase = 'needsWater')
                `, [itemId, expiresAt, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'agua') {
                const maxWater = (slotIndex >= 6) ? 4 : 2;
                const slotRes = await db.execute('SELECT water_expires_at, fase, crow_active, pest_active, crop_id, pot_expires_at FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
                const slot = slotRes.rows[0];

                let currentWaterEnd = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : Date.now();
                if (currentWaterEnd < Date.now()) currentWaterEnd = Date.now();

                const waterDurationMs = 2 * 3600000; // 2 horas cada água (PvU 2021 style)
                const newExpiresAt = new Date(currentWaterEnd + waterDurationMs);

                // Validar limite de águas (empilhamento de tempo: 2-4 gotas)
                if (newExpiresAt.getTime() > Date.now() + (maxWater * waterDurationMs)) {
                    throw new Error(`Limite de água atingido para este slot (Máx ${maxWater} gotas / ${maxWater * 2}h)`);
                }

                const updateRes = await db.execute(`
                    UPDATE fazenda_plantacoes
                    SET fase = CASE
                            WHEN crop_id IS NOT NULL AND crow_active = FALSE AND pest_active = FALSE AND (pot_expires_at IS NULL OR pot_expires_at > NOW()) THEN 'growing'
                            WHEN crop_id IS NULL AND (pot_expires_at IS NULL OR pot_expires_at > NOW()) THEN 'readyToPlant'
                            ELSE fase END,
                        water_expires_at = $1,
                        total_paused_ms = total_paused_ms + CASE
                            WHEN pause_started_at IS NOT NULL
                                 AND crow_active = FALSE AND pest_active = FALSE AND (pot_expires_at IS NULL OR pot_expires_at > NOW())
                            THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000)
                            ELSE 0 END,
                        pause_started_at = CASE
                            WHEN crow_active = TRUE OR pest_active = TRUE OR (pot_expires_at IS NOT NULL AND pot_expires_at <= NOW())
                            THEN COALESCE(pause_started_at, NOW())
                            ELSE NULL END
                    WHERE usuario_id = $2 AND slot_index = $3 AND (fase = 'needsWater' OR fase = 'readyToPlant' OR fase = 'growing')
                `, [newExpiresAt, userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (used) {
                    await db.execute(`
                        UPDATE fazenda_missoes_jogador
                        SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                        WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                        AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'water_slots')
                    `, [userId]);
                }
            } else if (itemId === 'espantalho') {
                const until = new Date(Date.now() + 7 * 24 * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET scarecrow_until = $1 WHERE usuario_id = $2 AND slot_index = $3", [until, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'pesticida') {
                const updateRes = await db.execute(`
                    UPDATE fazenda_plantacoes
                    SET pest_active = FALSE,
                        total_paused_ms = total_paused_ms + CASE
                            WHEN pause_started_at IS NOT NULL AND crow_active = FALSE AND water_expires_at > NOW() AND (pot_expires_at IS NULL OR pot_expires_at > NOW())
                            THEN (EXTRACT(EPOCH FROM (NOW() - pause_started_at)) * 1000)
                            ELSE 0 END,
                        pause_started_at = CASE
                            WHEN crow_active = TRUE OR water_expires_at <= NOW() OR (pot_expires_at IS NOT NULL AND pot_expires_at <= NOW())
                            THEN COALESCE(pause_started_at, NOW())
                            ELSE NULL END
                    WHERE usuario_id = $1 AND slot_index = $2 AND pest_active = TRUE
                `, [userId, slotIndex]);
                used = updateRes.rowCount > 0;
                if (used) {
                    await db.execute(`
                        UPDATE fazenda_missoes_jogador
                        SET progress = LEAST((SELECT target FROM fazenda_missoes_template WHERE id = template_id), progress + 1)
                        WHERE usuario_id = $1 AND claimed = FALSE AND expires_at > NOW()
                        AND template_id IN (SELECT id FROM fazenda_missoes_template WHERE tipo = 'use_pesticide')
                    `, [userId]);
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

            // Decidir próximo estado: se tiver pote e ainda tiver água, vai para readyToPlant
            let nextFase = 'needsPot';
            if (slot.pot_type) {
                const waterExpires = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : 0;
                nextFase = (waterExpires > Date.now()) ? 'readyToPlant' : 'needsWater';
            }

            await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE id = $2", [nextFase, slot.id]);
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

                    await db.execute("UPDATE fazenda_plantacoes SET fase = $1, crop_id = NULL, started_at = NULL, ends_at = NULL, crow_active = FALSE, pest_active = FALSE, reward_actual = 0 WHERE id = $2", [nextFase, slot.id]);
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
            const resMission = await db.execute("SELECT m.*, t.reward_type, t.reward_amount FROM fazenda_missoes_jogador m JOIN fazenda_missoes_template t ON m.template_id = t.id WHERE m.id = $1 AND m.usuario_id = $2 AND m.claimed = FALSE AND m.progress >= t.target", [missionId, userId]);
            if (!resMission.rows.length) throw new Error('Missão não disponível');
            await db.execute("UPDATE fazenda_missoes_jogador SET claimed = TRUE WHERE id = $1", [missionId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, resMission.rows[0].reward_type, resMission.rows[0].reward_amount.toString()]);

            // Regra Spec V1.0: 3 missões completadas = 1 nível no passe (simplificado: cada missão dá 34 XP, 100 XP = level up)
            await db.execute("INSERT INTO fazenda_season_pass_progresso (usuario_id, xp_atual) VALUES ($1, 34) ON CONFLICT (usuario_id) DO UPDATE SET xp_atual = fazenda_season_pass_progresso.xp_atual + 34", [userId]);

            // Check Level Up
            const prog = (await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId])).rows[0];
            let leveledUp = false;
            if (prog.xp_atual >= 100) {
                await db.execute("UPDATE fazenda_season_pass_progresso SET nivel_atual = nivel_atual + 1, xp_atual = xp_atual - 100 WHERE usuario_id = $1", [userId]);
                leveledUp = true;
            }
            return res.json({ success: true, leveledUp, newLevel: leveledUp ? prog.nivel_atual + 1 : prog.nivel_atual });
        }

        if (action === 'claim_pass_reward') {
            const level = parseInt(missionId); // Reutilizando campo missionId para o nível do passe
            const progRes = await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId]);
            const prog = progRes.rows[0];
            if (!prog || prog.nivel_atual < level || prog.claimed_levels.includes(level)) throw new Error("Recompensa não disponível");

            const tier = (await db.execute("SELECT * FROM fazenda_season_pass_template WHERE nivel = $1", [level])).rows[0];
            await db.execute("UPDATE fazenda_season_pass_progresso SET claimed_levels = array_append(claimed_levels, $1) WHERE usuario_id = $2", [level, userId]);
            await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + $3", [userId, tier.recompensa_tipo, tier.recompensa_quantidade.toString()]);
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
                WHERE id = $2
            `, [nextFase, slot.id]);
        }

        if (action === 'marketplace_list') {
            const check = await isFeatureEnabled('MARKETPLACE');
            if (!check.ativa) throw new Error(check.mensagem);

            if ((inventory[itemId] || 0n) < qty) throw new Error('Quantidade insuficiente no inventário');

            // Sistema de Escrow: Remove do inventário e coloca no marketplace (status vault)
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = $3", [qty.toString(), userId, itemId]);
            await db.execute("INSERT INTO fazenda_marketplace (vendedor_id, item_id, quantidade, preco_diamante, status) VALUES ($1, $2, $3, $4, 'listing')", [userId, itemId, qty.toString(), BigInt(price).toString()]);
        }

        if (action === 'marketplace_buy') {
            const marketRes = await db.execute("SELECT * FROM fazenda_marketplace WHERE id = $1 AND status = 'listing'", [itemId]);
            if (!marketRes.rows.length) throw new Error('Item não disponível ou já vendido');
            const entry = marketRes.rows[0];
            const totalCost = BigInt(entry.preco_diamante);

            if ((inventory['diamante'] || 0n) < totalCost) throw new Error('Diamantes insuficientes');

            // Taxa de Queima: 10%
            const burnAmount = totalCost / 10n;
            const sellerGain = totalCost - burnAmount;

            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [totalCost.toString(), userId]);
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [sellerGain.toString(), entry.vendedor_id]);
            await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade + $1 WHERE usuario_id = $2 AND item_id = $3", [entry.quantidade, userId, entry.item_id]);
            await db.execute("UPDATE fazenda_marketplace SET status = 'sold', updated_at = NOW() WHERE id = $1", [itemId]);

            await db.execute("INSERT INTO fazenda_audit_logs (usuario_id, acao, valor_novo) VALUES ($1, 'marketplace_buy', $2)", [userId, { market_id: itemId, burn: burnAmount.toString() }]);
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

// POST /api/game/checkin
router.post('/checkin', async (req, res) => {
    const userId = req.userId;
    try {
        const check = await isFeatureEnabled('CHECKIN_DIARIO');
        if (!check.ativa) throw new Error(check.mensagem);

        const today = new Date().toISOString().split('T')[0];

        // Tentar inserir o check-in
        const checkinRes = await db.execute(
            'INSERT INTO fazenda_checkin (usuario_id, data_dia) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, today]
        );

        if (checkinRes.rowCount === 0) {
            throw new Error('Você já realizou o check-in hoje!');
        }

        // Recompensa: 50 Ouro
        await db.execute(
            "INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', 50) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = fazenda_inventario.quantidade + 50",
            [userId]
        );

        // Ganhar XP do Passe de Temporada (ex: 20 XP por checkin)
        await db.execute("INSERT INTO fazenda_season_pass_progresso (usuario_id, xp_atual) VALUES ($1, 20) ON CONFLICT (usuario_id) DO UPDATE SET xp_atual = fazenda_season_pass_progresso.xp_atual + 20", [userId]);

        const prog = (await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId])).rows[0];
        let leveledUp = false;
        if (prog.xp_atual >= 100) {
            await db.execute("UPDATE fazenda_season_pass_progresso SET nivel_atual = nivel_atual + 1, xp_atual = xp_atual - 100 WHERE usuario_id = $1", [userId]);
            leveledUp = true;
        }

        res.json({ success: true, message: 'Check-in realizado! Você ganhou 50 Ouro e 20 XP.', leveledUp, newLevel: leveledUp ? prog.nivel_atual + 1 : prog.nivel_atual });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/game/season-pass
router.get('/season-pass', async (req, res) => {
    const userId = req.userId;
    try {
        const progRes = await db.execute("SELECT * FROM fazenda_season_pass_progresso WHERE usuario_id = $1", [userId]);
        const templates = await db.execute("SELECT * FROM fazenda_season_pass_template ORDER BY nivel");
        res.json({ progress: progRes.rows[0] || { nivel_atual: 1, xp_atual: 0, claimed_levels: [] }, tiers: templates.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/game/marketplace
router.get('/marketplace', async (req, res) => {
    try {
        const result = await db.execute("SELECT m.*, u.login as vendedor FROM fazenda_marketplace m JOIN fazenda_usuarios u ON m.vendedor_id = u.id WHERE m.status = 'listing' ORDER BY m.created_at DESC");
        res.json({ items: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
