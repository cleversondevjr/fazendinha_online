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

app.set('trust proxy', true);

// CORS Configuration - Allow all origins for development
app.use(cors({
    origin: function (origin, callback) { callback(null, true); },
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

sessionStore.on('error', (error) => {
    console.error('[SESSION STORE ERROR]', error);
});

app.use(session({
    name: 'fazendinha_sid',
    // store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fazendinha-secret-123',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'none',
        path: '/fazendinha/'
    }
}));

// Authentication Middleware
app.use((req, res, next) => {
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

    if (process.env.NODE_ENV === 'production') {
        if (!req.session.userId) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Sessão expirada ou não autorizado.' });
            }
            return res.redirect('/fazendinha/login.html');
        }
        req.userId = req.session.userId;
    } else {
        req.userId = req.session.userId || '1';
    }

    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Admin Authorization Middleware
const adminAuth = async (req, res, next) => {
    try {
        const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [req.userId]);
        const isAdmin = userRes.rows.length > 0 && userRes.rows[0].is_admin;

        if (!isAdmin) {
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

app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(frontendPath, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(frontendPath, 'script.js')));

app.use('/assets', express.static(assetsPath));
app.use('/sketches', express.static(path.join(frontendPath, 'sketches')));

require('./cron');
app.listen(port, () => console.log(`Server v5.0.1 running on ${port}`));
