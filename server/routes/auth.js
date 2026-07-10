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
<<<<<<< HEAD
=======
            req.session.userLogin = login; // Armazenando login para uso posterior
>>>>>>> main
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

<<<<<<< HEAD
            const match = await bcrypt.compare(password, user.senha);
            if (!match) {
=======
            if (password !== user.senha) {
>>>>>>> main
                console.log(`[AUTH] Senha incorreta para: ${login}`);
                return res.status(401).json({ error: 'Senha incorreta.' });
            }

            if (!req.session) {
                console.error(`[AUTH] Sessão não disponível!`);
                return res.status(500).json({ error: 'Erro de sessão no servidor.' });
            }

            req.session.userId = user.id;
<<<<<<< HEAD
=======
            req.session.userLogin = login; // Salvando o login para checagem do admin "CleversonS"
>>>>>>> main
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

router.get('/version', async (req, res) => {
<<<<<<< HEAD
    try {
        const result = await db.execute('SELECT valor FROM fazenda_config WHERE chave = $1', ['version']);
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v5.0.1' });
    } catch (err) { res.json({ version: 'v5.0.1' }); }
=======
    // Versão atualizada para V6.0.1 conforme solicitado
    res.json({ version: 'V6.0.1' });
>>>>>>> main
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
