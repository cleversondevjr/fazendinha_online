const db = require('./db');

async function runDiag() {
    console.log("--- INICIANDO DIAGNÓSTICO DO BANCO DE DADOS (FARM) ---");
    try {
        // 1. Teste de Conexão
        const timeRes = await db.execute('SELECT NOW()');
        console.log("[OK] Conexão estabelecida. Hora no servidor:", timeRes.rows[0].now);

        // 2. Verificação de Tabelas
        const tables = ['fazenda_usuarios', 'session', 'fazenda_plantacoes', 'fazenda_inventario', 'fazenda_config'];
        for (const table of tables) {
            const res = await db.execute(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = $1
                );
            `, [table]);
            const exists = res.rows[0].exists;
            console.log(`[${exists ? 'OK' : 'ERRO'}] Tabela '${table}': ${exists ? 'Encontrada' : 'NÃO ENCONTRADA'}`);

            if (exists) {
                const countRes = await db.execute(`SELECT COUNT(*) FROM "${table}"`);
                console.log(`     - Registros: ${countRes.rows[0].count}`);
            }
        }

        // 3. Verificação de Constraints em fazenda_usuarios
        if (tables.includes('fazenda_usuarios')) {
            console.log("\n--- Verificando Constraints (fazenda_usuarios) ---");
            const constraintsRes = await db.execute(`
                SELECT conname, contype
                FROM pg_constraint
                WHERE conrelid = 'fazenda_usuarios'::regclass;
            `);
            const constraints = constraintsRes.rows;
            const hasUniqueLogin = constraints.some(c => c.contype === 'u' || c.contype === 'p'); // simplificado
            console.log(`[INFO] Encontradas ${constraints.length} constraints.`);
            constraints.forEach(c => console.log(`     - ${c.conname} (${c.contype})`));
        }

        // 4. Verificação de Colunas em session
        console.log("\n--- Verificando Estrutura (session) ---");
        const sessionCols = await db.execute(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'session';
        `);
        if (sessionCols.rows.length > 0) {
            sessionCols.rows.forEach(c => console.log(`     - ${c.column_name}: ${c.data_type}`));
        } else {
            console.log("[ERRO] Tabela 'session' sem colunas ou não encontrada.");
        }

    } catch (err) {
        console.error("\n[FALHA CRÍTICA] Erro durante o diagnóstico:", err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error("DICA: O serviço PostgreSQL não está rodando ou o host no .env está incorreto.");
        }
    }
    console.log("\n--- DIAGNÓSTICO CONCLUÍDO ---");
    process.exit();
}

runDiag();
