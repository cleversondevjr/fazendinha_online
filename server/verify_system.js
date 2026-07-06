const db = require('./db');
require('dotenv').config();

async function verify() {
    console.log('--- Fazendinha Online System Verification ---');
    console.log('Time:', new Date().toLocaleString());
    console.log('Environment:', process.env.NODE_ENV || 'development');

    try {
        // 1. Database Connection
        const start = Date.now();
        const versionRes = await db.execute('SELECT version()');
        console.log('✅ Database Connected:', versionRes.rows[0].version.split(',')[0]);
        console.log('   Latency:', Date.now() - start, 'ms');

        // 2. Critical Tables Check
        const tables = [
            'fazenda_usuarios',
            'fazenda_plantacoes',
            'fazenda_inventario',
            'fazenda_itens_config',
            'fazenda_config',
            'fazenda_features'
        ];

        for (const table of tables) {
            const countRes = await db.execute(`SELECT COUNT(*) FROM ${table}`);
            console.log(`✅ Table ${table.padEnd(20)}: ${countRes.rows[0].count} records`);
        }

        // 3. Admin User Check
        const adminRes = await db.execute("SELECT login, email FROM fazenda_usuarios WHERE is_admin = TRUE");
        console.log('✅ Admin Users Found:', adminRes.rows.length);
        adminRes.rows.forEach(a => console.log(`   - ${a.login} (${a.email})`));

        // 3.1 All Users Check (Debug)
        const allUsersRes = await db.execute("SELECT id, login, is_admin FROM fazenda_usuarios LIMIT 10");
        console.log('✅ Recent Users:');
        allUsersRes.rows.forEach(u => console.log(`   - [ID: ${u.id}] ${u.login} (Admin: ${u.is_admin})`));

        // 4. Roadmap (Feature Flags) Status
        const featuresRes = await db.execute("SELECT chave, ativa, data_lancamento FROM fazenda_features");
        console.log('✅ Feature Flags:');
        featuresRes.rows.forEach(f => {
            const status = f.ativa ? 'ON ' : 'OFF';
            console.log(`   [${status}] ${f.chave.padEnd(20)} (Launch: ${new Date(f.data_lancamento).toLocaleDateString()})`);
        });

        console.log('\n--- Verification Complete: System is healthy ---');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err.message);
        process.exit(1);
    }
}

verify();
