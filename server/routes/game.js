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

        const itemsRes = await db.execute('SELECT * FROM fazenda_itens_config ORDER BY tipo, item_id');

        const featuresRes = await db.execute('SELECT chave, ativa, data_lancamento, mensagem_bloqueio FROM fazenda_features');
        const featuresMap = featuresRes.rows.reduce((acc, f) => {
            const isReleased = f.ativa && new Date() >= new Date(f.data_lancamento);
            acc[f.chave] = { released: isReleased, message: f.mensagem_bloqueio };
            return acc;
        }, {});

        res.json({
            inventory,
            slots,
            missions: missionsRes.rows,
            configs: configsMap,
            worldTree: treeMeta,
            items: itemsRes.rows,
            roadmap: featuresMap
        });
    } catch (err) {
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
            const discount = BigInt((await db.execute("SELECT valor FROM fazenda_config WHERE chave = 'global_discount'")).rows[0].valor || 0);

            if (item.price_diamonds > 0) {
                const totalDiamonds = BigInt(item.price_diamonds) * qty;
                if ((inventory['diamante'] || 0n) < totalDiamonds) throw new Error('Diamantes insuficientes');
                await db.execute("UPDATE fazenda_inventario SET quantidade = quantidade - $1 WHERE usuario_id = $2 AND item_id = 'diamante'", [totalDiamonds.toString(), userId]);
            } else {
                const unitPrice = BigInt(item.price_coins) * (100n - discount) / 100n;
                const totalCoins = unitPrice * qty;
                if ((inventory['coins'] || 0n) < totalCoins) throw new Error('Ouro insuficiente');
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
                const configsRes = await db.execute("SELECT chave, valor FROM fazenda_config WHERE chave = 'current_weather'");
                const weather = configsRes.rows[0]?.valor || 'sunny';

                let growHours = parseFloat(item.grow_hours);
                if (weather === 'rainy' && item.tipo === 'tree') growHours *= 0.8;
                if (weather === 'sunny' && item.tipo === 'flower') growHours *= 0.8;
                if (weather === 'windy') growHours *= 1.1;

                const endsAt = new Date(Date.now() + growHours * 3600000);
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET fase = 'growing', crop_id = $1, started_at = NOW(), ends_at = $2, reward_base = $3, reward_actual = $4, crow_active = FALSE, pest_active = FALSE, total_paused_ms = 0 WHERE usuario_id = $5 AND slot_index = $6 AND fase = 'readyToPlant'", [itemId, endsAt, item.reward_base, item.reward_base, userId, slotIndex]);
                used = updateRes.rowCount > 0;
            } else if (itemId === 'agua') {
                const slotRes = await db.execute('SELECT water_expires_at FROM fazenda_plantacoes WHERE usuario_id = $1 AND slot_index = $2', [userId, slotIndex]);
                const slot = slotRes.rows[0];
                let currentWaterEnd = slot.water_expires_at ? new Date(slot.water_expires_at).getTime() : Date.now();
                if (currentWaterEnd < Date.now()) currentWaterEnd = Date.now();
                const newExpiresAt = new Date(currentWaterEnd + 2 * 3600000);
                
                const updateRes = await db.execute("UPDATE fazenda_plantacoes SET water_expires_at = $1 WHERE usuario_id = $2 AND slot_index = $3", [newExpiresAt, userId, slotIndex]);
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
            await db.execute("UPDATE fazenda_plantacoes SET fase = 'needsPot', crop_id = NULL, started_at = NULL, ends_at = NULL, reward_actual = 0 WHERE id = $1", [slot.id]);
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

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
```[cite: 1]
