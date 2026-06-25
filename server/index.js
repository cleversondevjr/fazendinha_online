const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Update CORS to allow credentials from the main domain
app.use(cors({
    origin: ['https://sgiptv.com.br', 'http://sgiptv.com.br'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Middleware to extract User ID from the existing site session
app.use((req, res, next) => {
    // MODO TESTE: Se não houver ID, usa o ID 1 por padrão
    const id = req.cookies.usuario_id || req.headers['x-user-id'] || '1';

    req.userId = id;
    next();
});

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');

app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// Start Cron Jobs
require('./cron');

app.listen(port, () => {
    console.log(`Farm 2.0 Server running on port ${port}`);
});
