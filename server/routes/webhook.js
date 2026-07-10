const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Webhook secret (deixe vazio se não configurar no GitHub, ou use process.env)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * POST /api/webhook/github
 * Recebe notificações do GitHub quando há push na branch main
 * Executa o script de deploy automaticamente
 */
router.post('/github', (req, res) => {
    const logFile = path.join(__dirname, '..', '..', 'deploy.log');
    const timestamp = new Date().toISOString();

    try {
        // Log da requisição recebida
        const logEntry = `\n[${timestamp}] ✅ Webhook recebido do GitHub\n`;
        fs.appendFileSync(logFile, logEntry);
        console.log(logEntry);
        console.log('Headers recebidos:', JSON.stringify(req.headers, null, 2));

        // Validar evento (case-insensitive)
        const event = req.headers['x-github-event'] || req.headers['X-GitHub-Event'];
        const payload = req.body;

        if (event !== 'push') {
            const msg = `⚠️ Evento ignorado: ${event} (esperado: push)`;
            fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
            console.warn(msg);
            return res.status(200).json({ success: false, reason: 'not a push event' });
        }

        // Validar branch (deve ser main)
        const branch = payload.ref?.replace('refs/heads/', '');
        if (branch !== 'main') {
            const msg = `⚠️ Branch ignorada: ${branch} (esperado: main)`;
            fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
            console.warn(msg);
            return res.status(200).json({ success: false, reason: `branch ${branch} not main` });
        }

        fs.appendFileSync(logFile, `[${timestamp}] 📦 Preparando deploy para branch: ${branch}\n`);
        console.log(`📦 Preparando deploy para branch: ${branch}`);

        // Executar deploy.sh
        const deployScriptPath = path.join(__dirname, '..', '..', 'deploy.sh');
        
        fs.appendFileSync(logFile, `[${timestamp}] 🚀 Executando: ${deployScriptPath}\n`);
        console.log(`🚀 Executando deploy script...`);

        try {
            const output = execSync(`bash ${deployScriptPath}`, {
                cwd: path.join(__dirname, '..', '..'),
                stdio: 'pipe',
                timeout: 60000 // 60 segundos de timeout
            }).toString();

            fs.appendFileSync(logFile, `[${timestamp}] ✅ Deploy executado com sucesso!\n`);
            fs.appendFileSync(logFile, `[${timestamp}] OUTPUT:\n${output}\n`);
            console.log(`✅ Deploy executado com sucesso!`);
            console.log(output);

            return res.status(200).json({
                success: true,
                message: 'Deploy iniciado com sucesso',
                timestamp: timestamp
            });
        } catch (deployError) {
            const errorMsg = deployError.stderr?.toString() || deployError.message;
            fs.appendFileSync(logFile, `[${timestamp}] ❌ ERRO ao executar deploy:\n${errorMsg}\n`);
            console.error(`❌ ERRO:`, errorMsg);

            return res.status(500).json({
                success: false,
                error: 'Deploy falhou',
                details: errorMsg
            });
        }
    } catch (err) {
        const errorMsg = err.message;
        const logEntry = `[${timestamp}] ❌ ERRO no webhook: ${errorMsg}\n`;
        fs.appendFileSync(logFile, logEntry);
        console.error(logEntry);

        return res.status(500).json({
            success: false,
            error: errorMsg
        });
    }
});

/**
 * GET /api/webhook/logs
 * Retorna os últimos logs de deploy
 */
router.get('/logs', (req, res) => {
    try {
        const logFile = path.join(__dirname, '..', '..', 'deploy.log');
        if (!fs.existsSync(logFile)) {
            return res.json({ logs: 'Nenhum log de deploy encontrado ainda.' });
        }

        const logs = fs.readFileSync(logFile, 'utf-8');
        const lines = logs.split('\n').slice(-50).join('\n'); // Últimas 50 linhas

        return res.json({ logs: lines });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/webhook/test
 * Endpoint para testar o webhook manualmente
 */
router.post('/test', (req, res) => {
    const timestamp = new Date().toISOString();
    const logFile = path.join(__dirname, '..', '..', 'deploy.log');

    const logEntry = `[${timestamp}] 🧪 TESTE DE WEBHOOK EXECUTADO\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(logEntry);

    res.json({
        success: true,
        message: 'Webhook em funcionamento!',
        timestamp: timestamp,
        webhook_url: 'https://sgiptv.com.br/api/webhook/github'
    });
});

module.exports = router;
