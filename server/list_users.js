const db = require('./db');

async function debug() {
    try {
        console.log('--- BUSCANDO USUÁRIOS NO BANCO ---');
        const res = await db.execute('SELECT id, login, email, is_admin, created_at FROM fazenda_usuarios');
        if (res.rows.length === 0) {
            console.log('Nenhum usuário encontrado.');
        } else {
            console.table(res.rows);
        }

        console.log('\n--- VERIFICANDO CONFIGURAÇÕES ---');
        const configRes = await db.execute('SELECT * FROM fazenda_config WHERE chave = $1', ['game_version']);
        console.table(configRes.rows);

    } catch (err) {
        console.error('ERRO AO BUSCAR DADOS:', err.message);
    } finally {
        process.exit();
    }
}

debug();
