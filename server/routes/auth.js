const express = require('express');
const router = express.Router();
const db = require('../db');
const { ensureUserInitialized } = require('../utils/player_init');

router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;
    try {
        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha) VALUES ($1, $2, $3) RETURNING id',
            [login, email, password]
        );
        const userId = result.rows[0].id;
        await ensureUserInitialized(userId);
        res.json({ success: true, userId });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Login ou E-mail já estão em uso.' });
        res.status(500).json({ error: 'Erro interno: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const result = await db.execute(
            'SELECT id, senha, is_admin FROM fazenda_usuarios WHERE LOWER(login) = LOWER($1)',
            [login]
        );
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log(`[AUTH] User found: ${user.id}`);

            // Comparação em texto puro conforme requisito legado
            const match = (password === user.senha);
            if (!match) {
                console.log(`[AUTH] Password mismatch for: ${login}`);
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            console.log(`[AUTH] Login success for: ${login} (ID: ${user.id}, Admin: ${user.is_admin})`);

            if (req.session) {
                req.session.userId = user.id;
                console.log(`[AUTH] Session userId set to: ${req.session.userId}`);
            } else {
                console.error(`[AUTH] ERRO CRÍTICO: req.session está undefined para ${login}`);
                return res.status(500).json({ error: 'Erro ao inicializar sessão. Verifique o servidor.' });
            }

            res.json({ success: true, userId: user.id });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/version', async (req, res) => {
    try {
        const result = await db.execute('SELECT valor FROM fazenda_config WHERE chave = $1', ['version']);
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v3.0.5' });
    } catch (err) { res.json({ version: 'v3.0.5' }); }
});

router.post('/recover', async (req, res) => {
    const { login, email } = req.body;
    try {
        const result = await db.execute('SELECT id FROM fazenda_usuarios WHERE login = $1 AND email = $2', [login, email]);
        if (result.rows.length > 0) res.json({ success: true, message: 'Instruções enviadas.' });
        else res.status(404).json({ error: 'Dados não encontrados.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;