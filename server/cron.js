const cron = require('node-cron');
const db = require('./db');

/**
 * 1. Quest Rotation - Every 4 hours
 */
cron.schedule('0 */4 * * *', async () => {
    console.log('Rotating daily missions...');
    try {
        await db.execute('DELETE FROM fazenda_missoes_jogador WHERE expires_at <= NOW()');
        const usersRes = await db.execute('SELECT DISTINCT usuario_id FROM fazenda_plantacoes');
        const templatesRes = await db.execute('SELECT * FROM fazenda_missoes_template WHERE active = TRUE');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 4);
        for (const user of usersRes.rows) {
            const selected = weightedRandomSelect(templatesRes.rows, 5);
            for (const mission of selected) {
                await db.execute('INSERT INTO fazenda_missoes_jogador (usuario_id, template_id, expires_at) VALUES ($1, $2, $3)', [user.usuario_id, mission.id, expiresAt]);
            }
        }
    } catch (err) {
        console.error('Error rotating missions:', err);
    }
});

/**
 * 2. World Tree Meta - Every Monday at 00:00
 */
cron.schedule('0 0 * * 1', async () => {
    console.log('Calculating World Tree weekly meta...');
    try {
        const result = await db.execute('SELECT COUNT(DISTINCT usuario_id) as count FROM fazenda_plantacoes');
        const activeUsers = parseInt(result.rows[0].count) || 1;
        const dailyMeta = Math.max(1, Math.floor((activeUsers * 8) * 0.8));
        await db.execute('UPDATE fazenda_config SET valor = $1 WHERE chave = $2', [activeUsers, 'world_tree_active_users_last_week']);
        const today = new Date();
        for(let i=0; i<7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            await db.execute('INSERT INTO fazenda_arvore_meta (data_dia, meta_agua) VALUES ($1, $2) ON CONFLICT (data_dia) DO UPDATE SET meta_agua = $3', [dateStr, dailyMeta, dailyMeta]);
        }
    } catch (err) {
        console.error('Error calculating tree meta:', err);
    }
});

/**
 * 3. Game Tick - Every minute (Random Events & Penalties)
 */
cron.schedule('* * * * *', async () => {
    console.log('Processing game tick...');
    try {
        const configsRes = await db.execute('SELECT chave, valor FROM fazenda_config');
        const configs = configsRes.rows.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});
        const crowChance = parseFloat(configs.crow_chance_percent || 10) / 100;
        const pestChance = parseFloat(configs.pest_chance_percent || 20) / 100;

        const growingRes = await db.execute("SELECT * FROM fazenda_plantacoes WHERE fase = 'growing'");
        const weather = configs.current_weather || 'sunny';

        for (const plot of growingRes.rows) {
            let currentCrowChance = crowChance;
            let currentPestChance = pestChance;

            // Weather Impact
            if (weather === 'windy') currentCrowChance *= 1.5;
            if (weather === 'rainy') currentPestChance *= 0.5; // Rain helps wash away some pests?

            // Crow Event
            if (!plot.crow_active && !plot.scarecrow_until && Math.random() < (currentCrowChance / 60)) {
                await db.execute("UPDATE fazenda_plantacoes SET crow_active = TRUE, pause_started_at = NOW() WHERE id = $1", [plot.id]);
            }
            // Pest Event
            if (!plot.pest_active && Math.random() < (currentPestChance / 60)) {
                await db.execute("UPDATE fazenda_plantacoes SET pest_active = TRUE, last_pest_check = NOW() WHERE id = $1", [plot.id]);
            }
            // Pest Penalty
            if (plot.pest_active) {
                await db.execute("UPDATE fazenda_plantacoes SET reward_actual = GREATEST(0, reward_actual - (reward_base * 0.01)) WHERE id = $1", [plot.id]);
            }
        }
    } catch (err) {
        console.error('Error in game tick:', err);
    }
});

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
        for (let j = poolCopy.length - 1; j >= 0; j--) { if (poolCopy[j].id === picked.id) poolCopy.splice(j, 1); }
    }
    return selected;
}
