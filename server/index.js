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
    req.userId = req.session.userId || '1';
    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

app.use('/api/game', gameRoutes);
app.use('/api/admin', authRoutes); // Admin simulation
app.use('/api/auth', authRoutes);

app.use((req, res, next) => {
    const forbidden = ['.env', '.git', 'package.json', 'package-lock.json', 'deploy.sh'];
    if (forbidden.some(file => req.path.includes(file))) return res.status(403).send('Forbidden');
    next();
});

const frontendPath = path.join(__dirname, '..');
const whitelist = ['/', '/index.html', '/login.html', '/style.css', '/script.js', '/assets'];
app.get('*', (req, res, next) => {
    const requestedPath = req.path === '/' ? '/index.html' : req.path;
    if (whitelist.some(item => requestedPath.startsWith(item))) {
        const filePath = path.join(frontendPath, requestedPath);
        if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) return res.sendFile(filePath);
    }
    next();
});
app.use(express.static(frontendPath));

require('./cron');
app.listen(port, () => console.log(`Server v3.0.5 running on ${port}`));
