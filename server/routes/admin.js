const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// GET /api/admin/config - Get all configurations
router.get('/config', async (req, res) => {
    try {
        const configsRes = await db.execute('SELECT * FROM fazenda_config');
        const itemsRes = await db.execute('SELECT * FROM fazenda_itens_config ORDER BY tipo, item_id');
        const missionsRes = await db.execute('SELECT * FROM fazenda_missoes_template ORDER BY id');
        res.json({
            configs: configsRes.rows,
            items: itemsRes.rows,
            missions: missionsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/config/update - Update or create a specific config
router.post('/config/update', async (req, res) => {
    const { chave, valor } = req.body;
    try {
        await db.execute(`
            INSERT INTO fazenda_config (chave, valor)
            VALUES ($1, $2)
            ON CONFLICT (chave) DO UPDATE SET valor = $2, updated_at = NOW()
        `, [chave, valor]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/items/save - Create or Update item properties
router.post('/items/save', async (req, res) => {
    const { item_id, tipo, label, price_coins, price_diamonds, reward_base, grow_hours, image_asset } = req.body;
    try {
        await db.execute(`
            INSERT INTO fazenda_itens_config (item_id, tipo, label, price_coins, price_diamonds, reward_base, grow_hours, image_asset)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (item_id) DO UPDATE SET
                tipo = $2, label = $3, price_coins = $4, price_diamonds = $5, reward_base = $6, grow_hours = $7, image_asset = $8
        `, [item_id, tipo, label, price_coins || 0, price_diamonds || 0, reward_base || 0, grow_hours || 0, image_asset]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/missions/save - Create or Update mission templates
router.post('/missions/save', async (req, res) => {
    const { id, label, tipo, target, reward_type, reward_amount, weight, active } = req.body;
    try {
        if (id) {
            await db.execute(`
                UPDATE fazenda_missoes_template
                SET label = $1, tipo = $2, target = $3, reward_type = $4, reward_amount = $5, weight = $6, active = $7
                WHERE id = $8
            `, [label, tipo, target, reward_type, reward_amount, weight, active, id]);
        } else {
            await db.execute(`
                INSERT INTO fazenda_missoes_template (label, tipo, target, reward_type, reward_amount, weight, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [label, tipo, target, reward_type, reward_amount, weight, active]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/user/:id - Get user financial data and inventory
router.get('/user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const inventoryRes = await db.execute('SELECT item_id, quantidade FROM fazenda_inventario WHERE usuario_id = $1', [id]);
        const inventory = inventoryRes.rows.reduce((acc, curr) => ({ ...acc, [curr.item_id]: curr.quantidade }), {});

        // Also get list of all available items to allow adding them
        const itemsRes = await db.execute('SELECT item_id, label FROM fazenda_itens_config ORDER BY label');

        res.json({
            usuario_id: id,
            ouro: inventory.coins || 0,
            diamante: inventory.diamante || 0,
            energia: inventory.energia || 0,
            inventory: inventory,
            availableItems: itemsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/user/update - Update user financial data and items
router.post('/user/update', async (req, res) => {
    const { usuario_id, ouro, diamante, energia, items } = req.body;
    try {
        // Update Gold
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [usuario_id, ouro]);
        // Update Diamonds
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'diamante', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [usuario_id, diamante]);
        // Update Energy
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'energia', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [usuario_id, energia]);

        // Update specific items if provided
        if (items && typeof items === 'object') {
            for (const [itemId, qty] of Object.entries(items)) {
                await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $3", [usuario_id, itemId, qty]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/user/:id/slots - Get user slots
router.get('/user/:id/slots', async (req, res) => {
    const { id } = req.params;
    try {
        const slots = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1 ORDER BY slot_index', [id]);
        res.json({ slots: slots.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/slots/update - Update a specific slot
router.post('/slots/update', async (req, res) => {
    const { id, fase, crop_id, pot_type } = req.body;
    try {
        await db.execute(`
            UPDATE fazenda_plantacoes
            SET fase = $1, crop_id = $2, pot_type = $3
            WHERE id = $4
        `, [fase, crop_id, pot_type, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/stats - Basic database stats
router.get('/stats', async (req, res) => {
    try {
        const users = await db.execute('SELECT COUNT(DISTINCT usuario_id) FROM fazenda_plantacoes');
        const activeSlots = await db.execute("SELECT COUNT(*) FROM fazenda_plantacoes WHERE fase != 'locked'");
        const totalCoins = await db.execute("SELECT SUM(quantidade) FROM fazenda_inventario WHERE item_id = 'coins'");

        res.json({
            totalUsers: users.rows[0].count,
            activeSlots: activeSlots.rows[0].count,
            totalEconomy: totalCoins.rows[0].sum
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/missions/save - Create or Update mission templates
router.post('/missions/save', async (req, res) => {
    const { id, label, tipo, target, reward_type, reward_amount, weight, active } = req.body;
    try {
        if (id) {
            await db.execute(`
                UPDATE fazenda_missoes_template
                SET label = $1, tipo = $2, target = $3, reward_type = $4, reward_amount = $5, weight = $6, active = $7
                WHERE id = $8
            `, [label, tipo, target, reward_type, reward_amount, weight, active, id]);
        } else {
            await db.execute(`
                INSERT INTO fazenda_missoes_template (label, tipo, target, reward_type, reward_amount, weight, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [label, tipo, target, reward_type, reward_amount, weight, active]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/stats - Basic database stats
router.get('/stats', async (req, res) => {
    try {
        const users = await db.execute('SELECT COUNT(DISTINCT usuario_id) FROM fazenda_plantacoes');
        const activeSlots = await db.execute("SELECT COUNT(*) FROM fazenda_plantacoes WHERE fase != 'locked'");
        const totalCoins = await db.execute("SELECT SUM(quantidade) FROM fazenda_inventario WHERE item_id = 'coins'");

        res.json({
            totalUsers: users.rows[0].count,
            activeSlots: activeSlots.rows[0].count,
            totalEconomy: totalCoins.rows[0].sum
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/items/:id - Delete an item
router.delete('/items/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM fazenda_itens_config WHERE item_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/missions/:id - Delete a mission template
router.delete('/missions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM fazenda_missoes_jogador WHERE template_id = $1', [id]);
        await db.execute('DELETE FROM fazenda_missoes_template WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/assets - List all images in assets folders
router.get('/assets', (req, res) => {
    try {
        const assetsPath = path.join(__dirname, '../../assets');
        const flowersPath = path.join(__dirname, '../../assets/flores');

        const mainAssets = fs.readdirSync(assetsPath).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
        const flowerAssets = fs.readdirSync(flowersPath).filter(f => f.endsWith('.png')).map(f => `flores/${f}`);

        res.json({
            images: [...mainAssets, ...flowerAssets]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
