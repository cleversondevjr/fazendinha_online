const express = require('express');
const router = express.Router();
const db = require('../db');
const { ensureUserInitialized } = require('../utils/player_init');

router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;
    console.log(`[AUTH] Register attempt: ${login} (${email})`);
    try {
        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha) VALUES ($1, $2, $3) RETURNING id',
            [login, email, password]
        );

        const userId = result.rows[0].id;
        console.log(`[AUTH] User created successfully: ${userId}`);

        // Inicializa dados do jogador imediatamente
        await ensureUserInitialized(userId);

        if (req.session) {
            req.session.userId = userId;
        }

        res.json({ success: true, userId });
    } catch (err) {
        console.error(`[AUTH] Registration error for ${login}:`, err);
        if (err.code === '23505') { // Unique violation em Postgres
            return res.status(400).json({ error: 'Login ou E-mail já estão em uso.' });
        }
        res.status(500).json({ error: 'Erro interno ao criar conta: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    console.log(`[AUTH] Login attempt for: "${login}"`);
    try {
        const result = await db.execute(
            'SELECT id, senha, is_admin FROM fazenda_usuarios WHERE LOWER(login) = LOWER($1)',
            [login]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log(`[AUTH] User found: ${user.id}`);

            if (password !== user.senha) {
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
            console.log(`[AUTH] User not found: ${login}`);
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        console.error(`[AUTH] Error during login:`, err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/recover', async (req, res) => {
    const { login, email } = req.body;
    try {
        const result = await db.execute(
            'SELECT id FROM fazenda_usuarios WHERE login = $1 AND email = $2',
            [login, email]
        );
        if (result.rows.length > 0) {
            // Simulação de envio de e-mail
            res.json({ success: true, message: 'Instruções de recuperação enviadas para o e-mail.' });
        } else {
            res.status(404).json({ error: 'Dados não encontrados.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
