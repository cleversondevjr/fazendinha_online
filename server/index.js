const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Confia no proxy para sessões seguras via Cloudflare/Nginx
app.set('trust proxy', true);

// Update CORS to allow credentials from the main domain
const allowedOrigins = [
    'https://sgiptv.com.br',
    'http://sgiptv.com.br',
    'https://www.sgiptv.com.br',
    'http://www.sgiptv.com.br'
];

app.use(cors({
    origin: function (origin, callback) { callback(null, true); },
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
    origin: function (origin, callback) { callback(null, true); },
======
<<<<<< v5.0.1
    origin: function (origin, callback) { callback(null, true); },
======
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
>>>>>> main

    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const db = require('./db');
const sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true // Garante a existência da tabela de sessão
});

// Captura erros no store de sessão para evitar crash do servidor
sessionStore.on('error', (error) => {
    console.error('[SESSION STORE ERROR]', error);
});

app.use(session({
    name: 'fazendinha_sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fazendinha-secret-123',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        secure: true, // Habilitado para HTTPS do Cloudflare
        sameSite: 'none', // Requerido para cross-site cookies
        path: '/fazendinha/' // Escopo restrito ao subdiretório
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        secure: true, // Habilitado para HTTPS do Cloudflare
        sameSite: 'none', // Requerido para cross-site cookies
        path: '/fazendinha/' // Escopo restrito ao subdiretório
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
        secure: false, // Reverted for troubleshooting connection errors
        sameSite: 'lax',
        path: '/'
======
<<<<<< v5.0.1
        secure: false, // Reverted for troubleshooting connection errors
        sameSite: 'lax',
        path: '/'
======
        secure: true,
        sameSite: 'none',
        path: '/fazendinha/'
>>>>>> main

    }
}));

app.use((req, res, next) => {
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
>>>>>> main

    // Permitir acesso a arquivos estáticos e rotas de autenticação sem sessão
    const publicPaths = [
        '/login.html',
        '/style.css',
        '/script.js',
        '/assets',
        '/api/auth',
        '/favicon.ico'
    ];

    const isPublic = publicPaths.some(p => req.path.startsWith(p)) || req.path === '/';

    if (isPublic) return next();
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
======
    if (req.path.startsWith('/api/auth')) return next();
>>>>>> main


    // Em produção, não permitimos fallback para userId=1
    if (process.env.NODE_ENV === 'production') {
        if (!req.session.userId) {
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
>>>>>> main

            // Se for uma chamada de API, retorna 401. Se for navegação, redireciona pro login.
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Sessão expirada ou não autorizado.' });
            }
            return res.redirect('/fazendinha/login.html');
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
======
======
            return res.status(401).json({ error: 'Sessão expirada ou não autorizado.' });
>>>>>> main

        }
        req.userId = req.session.userId;
    } else {
        // Em desenvolvimento, permitimos fallback para facilitar testes
        req.userId = req.session.userId || '1';
    }

    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Middleware de Proteção Admin
const adminAuth = async (req, res, next) => {
    try {
        const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [req.userId]);
        if (userRes.rows.length === 0 || !userRes.rows[0].is_admin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Erro ao validar permissões.' });
    }
};

app.use('/api/game', gameRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/auth', authRoutes);

const frontendPath = path.join(__dirname, '..');
const assetsPath = path.join(frontendPath, 'assets');

// Servir arquivos específicos permitidos
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(frontendPath, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(frontendPath, 'script.js')));

// Servir assets estáticos
app.use('/assets', express.static(assetsPath));
app.use('/sketches', express.static(path.join(frontendPath, 'sketches')));

require('./cron');
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
app.listen(port, () => console.log(`Server v5.0.1 running on ${port}`));
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
app.listen(port, () => console.log(`Server v5.0.1 running on ${port}`));
======
<<<<<< feature/v3.0.1-final-sync-14719019057366838169
app.listen(port, () => console.log(`Server v3.0.1 running on ${port}`));
======
<<<<<< v5.0.1
app.listen(port, () => console.log(`Server v3.0.1 running on ${port}`));
======
app.listen(port, () => console.log(`Server v4.0.0 running on ${port}`));
>>>>>> main

