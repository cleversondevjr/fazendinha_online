const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

// Middleware to extract User ID
app.use((req, res, next) => {
    // 1. Prioridade para o Cookie (Usado no site principal)
    let id = req.cookies.usuario_id;

    // 2. Fallback para Header (Caso de apps ou chamadas de API externas autorizadas)
    if (!id) id = req.headers['x-user-id'];

    // 3. Segurança: Se não houver ID e não estivermos em ambiente de desenvolvimento, bloquear
    if (!id && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Não autorizado. Faça login no site principal.' });
    }

    // Modo Desenvolvimento/Teste: ID 1 se nada for fornecido
    req.userId = id || '1';
    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Middleware de Proteção Admin
const adminAuth = (req, res, next) => {
    const adminId = process.env.ADMIN_USER_ID || '1'; // Define quem é admin via .env
    if (String(req.userId) !== String(adminId)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

app.use('/api/game', gameRoutes);
app.use('/api/admin', adminAuth, adminRoutes); // Admin routes protected
app.use('/api/auth', authRoutes);

// Start Cron Jobs
require('./cron');

app.listen(port, () => {
    console.log(`Farm 2.0 Server running on port ${port}`);
});
