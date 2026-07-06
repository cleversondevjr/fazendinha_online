const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.url}`);
    if (req.url === '/fazendinha/api/game/state') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            inventory: { coins: 1000, diamante: 0, energia: 999 },
            slots: Array.from({length: 8}, (_, i) => ({
                slot_index: i,
                fase: i < 6 ? 'readyToPlant' : 'locked'
            })),
            roadmap: {
                'LOJA_DIAMANTE': { released: false, message: "Bloqueado para testes" },
                'SLOTS_PREMIUM': { released: false, message: "Slots em breve" }
            },
            items: [],
            configs: { game_version: '3.0.1' }
        }));
        return;
    }

    let filePath = '.' + req.url.replace('/fazendinha/', '/');
    if (filePath === './') filePath = './index.html';

    // Serve from root too if needed
    const actualPath = path.resolve(filePath.startsWith('./') ? filePath.slice(2) : filePath);

    if (fs.existsSync(actualPath) && fs.lstatSync(actualPath).isFile()) {
        const ext = path.extname(actualPath);
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
        fs.createReadStream(actualPath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(3003, () => console.log('Mock server running on port 3003'));
