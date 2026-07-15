const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

app.set('trust proxy', true);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

const db = require('./db');

const sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: true
});

sessionStore.on('error', err => {
    console.error('[SESSION STORE ERROR]', err);
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
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
    }
}));

const webhookRoutes = require('./routes/webhook');
app.use('/api/webhook', webhookRoutes);

app.use((req, res, next) => {

    const publicPaths = [
        '/',
        '/index.html',
        '/login.html',
        '/style.css',
        '/script.js',
        '/assets',
        '/favicon.ico',
        '/api/auth',
        '/api/webhook'
    ];

    const isPublic =
        publicPaths.some(p => req.path === p || req.path.startsWith(p + '/'));

    if (isPublic) {
        return next();
    }

    if (!req.session) {
        console.error('Sessão inexistente');
        return res.status(500).json({
            error: 'Session middleware não inicializado.'
        });
    }

    if (process.env.NODE_ENV === 'production') {

        if (!req.session.userId) {

            if (req.path.startsWith('/api/')) {
                return res.status(401).json({
                    error: 'Sessão expirada ou não autorizado.'
                });
            }

            return res.redirect('/login.html');
        }

        req.userId = req.session.userId;

    } else {

        req.userId = req.session.userId || 1;

    }

    next();

});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const adminAuth = async (req, res, next) => {

    try {

        const userRes = await db.execute(
            'SELECT is_admin FROM fazenda_usuarios WHERE id=$1',
            [req.userId]
        );

        const isAdmin =
            userRes.rows.length &&
            userRes.rows[0].is_admin;

        if (!isAdmin) {
            return res.status(403).json({
                error: 'Acesso negado.'
            });
        }

        next();

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: 'Erro interno.'
        });

    }

};

app.use('/api/game', gameRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/auth', authRoutes);

const frontendPath = path.join(__dirname, '..');

app.use(express.static(frontendPath));

app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/sketches', express.static(path.join(frontendPath, 'sketches')));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

require('./cron');

app.listen(port, () => {
    console.log(`Server v5.0.1 running on ${port}`);
});
