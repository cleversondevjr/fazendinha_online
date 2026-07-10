const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt'); // Adicionado para segurança
const { ensureUserInitialized } = require('../utils/player_init');

router.post('/register', async (req, res) => {
    const { login, email, password } = req.body;
    try {
        // Hash da senha antes de salvar
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.execute(
            'INSERT INTO fazenda_usuarios (login, email, senha) VALUES ($1, $2, $3) RETURNING id',
            [login, email, hashedPassword]
        );
        
        const userId = result.rows[0].id;
        await ensureUserInitialized(userId);

        if (req.session) {
            req.session.userId = userId;
            req.session.userLogin = login;
        }

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

            // Comparação segura usando bcrypt
            const match = await bcrypt.compare(password, user.senha);
            if (!match) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            req.session.userId = user.id;
            req.session.userLogin = login;
            
            req.session.save((err) => {
                if (err) return res.status(500).json({ error: 'Falha na sessão.' });
                res.json({ success: true, userId: user.id });
            });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro no banco de dados.' });
    }
});

router.get('/version', (req, res) => {
    res.json({ version: 'V6.0.1' });
});

router.post('/recover', async (req, res) => {
    const { login, email } = req.body;
    try {
        const result = await db.execute('SELECT id FROM fazenda_usuarios WHERE login = $1 AND email = $2', [login, email]);
        if (result.rows.length > 0) res.json({ success: true, message: 'Instruções enviadas.' });
        else res.status(404).json({ error: 'Dados não encontrados.' });
    } catch (err) { res.status(500).json({ error: 'Erro interno.' }); }
});

module.exports = router;
