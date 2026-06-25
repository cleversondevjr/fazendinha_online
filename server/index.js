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
    // Priority: 1. Cookie 'usuario_id' (common for simple PHP/Legacy sites)
    //           2. Header 'x-user-id' (for testing/mobile)
    const id = req.cookies.usuario_id || req.headers['x-user-id'];

    if (!id) {
        // Return 401 Unauthorized if no user is found
        return res.status(401).json({
            error: 'Sessão expirada',
            loginUrl: '/fazendinha/login'
        });
    }

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
