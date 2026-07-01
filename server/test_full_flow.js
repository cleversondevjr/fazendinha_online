const fs = require('fs');

async function testFlow() {
    console.log("--- TESTE DE CONSISTÊNCIA DE CÓDIGO ---");

    const filesToVerify = [
        'server/index.js',
        'server/routes/auth.js',
        'server/routes/admin.js',
        'server/utils/player_init.js',
        'server/.env',
        'login.html',
        'index.html'
    ];

    filesToVerify.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`[OK] ${file} existe.`);
        } else {
            console.error(`[FALHA] ${file} NÃO ENCONTRADO!`);
        }
    });

    console.log("\nVerificando configurações de Proxy no index.js...");
    const indexContent = fs.readFileSync('server/index.js', 'utf8');
    if (indexContent.includes("app.set('trust proxy', 1)") && indexContent.includes("proxy: true")) {
        console.log("[OK] Configurações de proxy encontradas.");
    } else {
        console.error("[FALHA] Configurações de proxy incompletas no index.js");
    }

    console.log("\n--- FIM DA VERIFICAÇÃO ---");
}

testFlow();
