const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
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
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) callback(null, true);
        else callback(new Error('Bloqueado pelo CORS'));
    },
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

sessionStore.on('error', (error) => console.error('[SESSION STORE ERROR]', error));

app.use(session({
    name: 'fazendinha_sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fazendinha-secret-123',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'none',
        path: '/'
    }
}));

app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth')) return next();
    if (!req.session.userId && process.env.NODE_ENV === 'production') return res.status(401).json({ error: 'Não autorizado.' });
    req.userId = req.session.userId || (process.env.NODE_ENV === 'production' ? null : '1');
    if (!req.userId && !req.path.startsWith('/api/auth')) return res.status(401).json({ error: 'Sessão inválida.' });
    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const adminAuth = async (req, res, next) => {
    try {
        const userRes = await db.execute('SELECT is_admin FROM fazenda_usuarios WHERE id = $1', [req.userId]);
        if (userRes.rows.length === 0 || !userRes.rows[0].is_admin) return res.status(403).json({ error: 'Acesso negado.' });
        next();
    } catch (err) { res.status(500).json({ error: 'Erro de validação.' }); }
};

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/auth', authRoutes);

// Whitelist de arquivos estáticos
const path = require('path');
const fs = require('fs');
app.use((req, res, next) => {
    const forbidden = ['.env', '.git', 'package.json', 'package-lock.json', 'deploy.sh', 'hooks.json'];
    if (forbidden.some(file => req.path.includes(file))) return res.status(403).send('Proibido');
    next();
});

const frontendPath = path.join(__dirname, '..');
const whitelist = ['/', '/index.html', '/login.html', '/style.css', '/script.js', '/assets', '/admin_fazendinha.html'];
app.get('*', (req, res, next) => {
    const requestedPath = req.path === '/' ? '/index.html' : req.path;
    if (whitelist.some(item => requestedPath.startsWith(item))) {
        const filePath = path.join(frontendPath, requestedPath);
        if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) return res.sendFile(filePath);
        else if (requestedPath.startsWith('/assets')) return next();
    }
    next();
});
app.use(express.static(frontendPath));

require('./cron');
app.listen(port, () => console.log(`Server v3.0.4 running on ${port}`));
