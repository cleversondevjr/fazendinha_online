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

/**
 * Ensures a user has all initial data (plots, inventory, missions)
 * @param {string|number} userId
 */
async function ensureUserInitialized(userId) {
    const slots = await db.execute('SELECT * FROM fazenda_plantacoes WHERE usuario_id = $1', [userId]);
    if (slots.rows.length === 0) {
        console.log(`[INIT] Initializing data for user ${userId}...`);
        for (let i = 0; i < 8; i++) {
            // Todos iniciam como locked
            await db.execute('INSERT INTO fazenda_plantacoes (usuario_id, slot_index, fase) VALUES ($1, $2, $3)', [userId, i, 'locked']);
        }
        await db.execute("INSERT INTO fazenda_inventario (usuario_id, item_id, quantidade) VALUES ($1, 'coins', 1000), ($1, 'energia', 100)", [userId]);
        await db.execute("INSERT INTO fazenda_config (chave, valor) VALUES ('last_energy_sync_' || $1, NOW()::text) ON CONFLICT (chave) DO NOTHING", [userId]);

        // Atribuir missões iniciais imediatamente
        await assignInitialMissions(userId);
        console.log(`[INIT] Data initialized for user ${userId}.`);
    }
}

module.exports = {
    ensureUserInitialized,
    assignInitialMissions
};
