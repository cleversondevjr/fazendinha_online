const db = require('./db');
async function test() {
    const res = await db.execute('SELECT * FROM fazenda_usuarios WHERE id = 1');
    console.log('Dados do usuário:', res.rows);
}
test();
