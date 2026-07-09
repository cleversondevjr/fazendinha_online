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
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
=======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< v5.0.1
======
>>>>>> main

        if (req.session) {
            req.session.userId = userId;
        }

<<<<<< feature/v3.0.1-final-sync-14719019057366838169
=======
>>>>>> main

>>>>>> main
        res.json({ success: true, userId });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Login ou E-mail já estão em uso.' });
        res.status(500).json({ error: 'Erro interno: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    console.log(`[AUTH] Tentativa de login: ${login}`);
    try {
        const result = await db.execute(
            'SELECT id, senha, is_admin FROM fazenda_usuarios WHERE LOWER(login) = LOWER($1)',
            [login]
        );
        if (result.rows.length > 0) {
            const user = result.rows[0];

            if (password !== user.senha) {
                console.log(`[AUTH] Senha incorreta para: ${login}`);
                return res.status(401).json({ error: 'Senha incorreta.' });
            }

            if (!req.session) {
                console.error(`[AUTH] Sessão não disponível!`);
                return res.status(500).json({ error: 'Erro de sessão no servidor.' });
            }

            req.session.userId = user.id;
            req.session.save((err) => {
                if (err) {
                    console.error('[AUTH] Erro ao salvar sessão:', err);
                    return res.status(500).json({ error: 'Falha ao salvar sessão.' });
                }
                console.log(`[AUTH] Login OK: ${login} (ID: ${user.id})`);
                res.json({ success: true, userId: user.id });
            });
        } else {
            console.log(`[AUTH] Usuário não encontrado: ${login}`);
            res.status(401).json({ error: 'Usuário não encontrado.' });
        }
    } catch (err) {
        console.error('[AUTH] Erro interno:', err);
        res.status(500).json({ error: 'Erro no banco de dados.' });
    }
});

router.get('/version', async (req, res) => {
    try {
        const result = await db.execute('SELECT valor FROM fazenda_config WHERE chave = $1', ['version']);
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v5.0.1' });
    } catch (err) { res.json({ version: 'v5.0.1' }); }
=======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v5.0.1' });
    } catch (err) { res.json({ version: 'v5.0.1' }); }
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v3.0.1' });
    } catch (err) { res.json({ version: 'v3.0.1' }); }
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v3.0.1' });
    } catch (err) { res.json({ version: 'v3.0.1' }); }
======
<<<<<< v5.0.1
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v3.0.1' });
    } catch (err) { res.json({ version: 'v3.0.1' }); }
======
        res.json({ version: result.rows.length > 0 ? result.rows[0].valor : 'v4.0.0' });
    } catch (err) { res.json({ version: 'v4.0.0' }); }
>>>>>> main

>>>>>> main
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
