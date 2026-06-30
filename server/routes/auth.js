const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;
    try {
        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha) VALUES ($1, $2, $3) RETURNING id',
            [login, email, password]
        );
        res.json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar conta. Login ou E-mail já existem.' });
    }
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const result = await db.execute(
            'SELECT id FROM fazenda_usuarios WHERE login = $1 AND senha = $2',
            [login, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, userId: result.rows[0].id });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
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
