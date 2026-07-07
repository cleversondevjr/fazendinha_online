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
        if (req.session) req.session.userId = userId;
        res.json({ success: true, userId });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Login ou E-mail já em uso.' });
        res.status(500).json({ error: err.message });
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
            if (password !== user.senha) return res.status(401).json({ error: 'Credenciais inválidas.' });
            if (req.session) req.session.userId = user.id;
            res.json({ success: true, userId: user.id });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
