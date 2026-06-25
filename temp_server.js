const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());

// Mock API responses
app.get('/fazendinha/api/game/status', (req, res) => {
    res.json({
        user: { coins: 1000, diamonds: 50, energy: 100 },
        slots: Array(8).fill(null).map((_, i) => ({
            id: i + 1,
            plant_id: null,
            status: 'vazio'
        })),
        world_tree: { level: 1, total_donations: 500, rewards_claimed: [] },
        missions: []
    });
});

app.get('/fazendinha/api/admin/config', (req, res) => {
    res.json({
        configs: [],
        items: [
            { item_id: 'vaso_pequeno', label: 'Vaso Pequeno', tipo: 'item', price_coins: 50, price_diamonds: 0 },
            { item_id: 'girassol', label: 'Girassol', tipo: 'flower', price_coins: 100, price_diamonds: 0 }
        ],
        missions: []
    });
});

app.get('/fazendinha/api/admin/assets', (req, res) => {
    res.json({
        images: ['vaso_pequeno.png', 'girassol.png', 'agua.png', 'corvo.png']
    });
});

// Serve static files with /fazendinha prefix
app.use('/fazendinha', express.static(__dirname));

app.listen(port, () => {
    console.log(`Mock server running at http://localhost:${port}/fazendinha/`);
});
