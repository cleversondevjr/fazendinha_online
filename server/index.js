const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Update CORS to allow credentials from the main domain
app.use(cors({
    origin: ['https://sgiptv.com.br', 'http://sgiptv.com.br', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const db = require('./db');

app.use(session({
    store: new pgSession({
        pool: db.pool, // We need to expose the pool
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'fazendinha-secret-123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 } // 30 minutos
}));

// Middleware to extract User ID from Session
app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth')) return next();

    if (!req.session.userId && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Não autorizado. Faça login.' });
    }

    req.userId = req.session.userId || '1';
    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Middleware de Proteção Admin
const adminAuth = async (req, res, next) => {
    try {
        const db = require('./db');
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
app.use('/api/admin', adminAuth, adminRoutes); // Admin routes protected
app.use('/api/auth', authRoutes);

// Start Cron Jobs
require('./cron');

app.listen(port, () => {
    console.log(`Farm 2.0 Server running on port ${port}`);
});
