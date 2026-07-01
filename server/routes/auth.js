const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha) VALUES ($1, $2, $3) RETURNING id',
            [login, email, hashedPassword]
        );
        res.json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar conta. Login ou E-mail já existem.' });
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
            console.log(`[AUTH] User found: ${user.id}, hashed pass length: ${user.senha ? user.senha.length : 0}`);

            const match = await bcrypt.compare(password, user.senha);
            if (!match) {
                console.log(`[AUTH] Password mismatch for: ${login}`);
                // Debug password length if mismatch
                console.log(`[AUTH] Input password length: ${password ? password.length : 0}`);
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            console.log(`[AUTH] Login success for: ${login} (ID: ${user.id}, Admin: ${user.is_admin})`);
            req.session.userId = user.id;

            // Log session after setting
            console.log(`[AUTH] Session userId set to: ${req.session.userId}`);

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
