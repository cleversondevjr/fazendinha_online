const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Confia no proxy para sessões seguras via Cloudflare/Nginx
app.set('trust proxy', 1);

// Update CORS to allow credentials from the main domain
const allowedOrigins = [
    'https://sgiptv.com.br',
    'http://sgiptv.com.br',
    'https://www.sgiptv.com.br',
    'http://www.sgiptv.com.br'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin (como mobile apps ou curl) ou se estiver na lista permitida
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado pelo CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const db = require('./db');

const sessionStore = new pgSession({
    pool: db.pool,
    tableName: 'session',
    createTableIfMissing: false // Já lidamos com isso nas migrações
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
    proxy: true, // Necessário para Cloudflare
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'lax',
        path: '/fazendinha/'
    }
}));

// Middleware to extract User ID from Session
app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth')) return next();

    // Bloqueia acesso sem sessão se estiver em produção
    if (!req.session.userId && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Não autorizado. Faça login.' });
    }

    // Fallback apenas para desenvolvimento
    req.userId = req.session.userId || (process.env.NODE_ENV === 'production' ? null : '1');

    if (!req.userId && !req.path.startsWith('/api/auth')) {
        return res.status(401).json({ error: 'Sessão inválida.' });
    }

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), env: process.env.NODE_ENV });
});

app.use('/api/game', gameRoutes);
app.use('/api/admin', adminAuth, adminRoutes); // Admin routes protected
app.use('/api/auth', authRoutes);

// Start Cron Jobs
require('./cron');

app.listen(port, () => {
    console.log(`Farm 2.0 Server running on port ${port}`);
});
