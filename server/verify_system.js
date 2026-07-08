const db = require('./db');

async function verifySystem() {
    console.log("--- FAZENDINHA ONLINE: DIAGNÓSTICO DE SISTEMA ---");
    try {
        // 1. Versão do Jogo
        const configRes = await db.execute('SELECT valor FROM fazenda_config WHERE chave = $1', ['game_version']);
        const version = configRes.rows.length > 0 ? configRes.rows[0].valor : 'NÃO DEFINIDA';
        console.log(`[VERSION] Versão Atual: ${version}`);

        // 2. Status das Feature Flags
        console.log("\n[FEATURES] Status do Roadmap:");
        const featuresRes = await db.execute('SELECT feature_key, status, release_date FROM fazenda_features ORDER BY feature_key');
        if (featuresRes.rows.length > 0) {
            console.table(featuresRes.rows);
        } else {
            console.log("Nenhuma Feature Flag cadastrada.");
        }

        // 3. Integridade de Usuários
        console.log("\n[USERS] Lista de Usuários:");
        const usersRes = await db.execute('SELECT id, login, email, is_admin, SUBSTRING(senha, 1, 3) || \'***\' as pass_hint FROM fazenda_usuarios');
        if (usersRes.rows.length > 0) {
            console.table(usersRes.rows);
        } else {
            console.log("Nenhum usuário encontrado.");
        }

        // 4. Slots e Plantios (Amostra)
        const plotsRes = await db.execute('SELECT COUNT(*) as total FROM fazenda_plantacoes');
        console.log(`\n[PLOTS] Total de Slots Ativos: ${plotsRes.rows[0].total}`);

    } catch (err) {
        console.error("\n[ERRO CRÍTICO] Falha ao verificar sistema:", err.message);
    } finally {
        process.exit();
    }
}

verifySystem();
