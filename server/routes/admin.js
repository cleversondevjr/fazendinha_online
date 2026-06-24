const express = require('express');
const router = express.Router();
const db = require('../db');

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

// POST /api/admin/config/update - Update a specific config
router.post('/config/update', async (req, res) => {
    const { chave, valor } = req.body;
    try {
        await db.execute('UPDATE fazenda_config SET valor = $1 WHERE chave = $2', [valor, chave]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/items/update - Update item properties
router.post('/items/update', async (req, res) => {
    const { item_id, price_coins, reward_base, grow_hours } = req.body;
    try {
        await db.execute(`
            UPDATE fazenda_itens_config
            SET price_coins = $1, reward_base = $2, grow_hours = $3
            WHERE item_id = $4
        `, [price_coins, reward_base, grow_hours, item_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/user/update-resources - Update user coins, diamonds, energy
router.post('/user/update-resources', async (req, res) => {
    const { userId, coins, diamante, energia } = req.body;
    try {
        if (coins !== undefined) await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [userId, coins]);
        if (diamante !== undefined) await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'diamante', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [userId, diamante]);
        if (energia !== undefined) await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'energia', $2) ON CONFLICT (usuario_id, item_id) DO UPDATE SET quantidade = $2", [userId, energia]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
