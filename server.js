const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/deploy', (req, res) => {
    const payload = req.body;

    // Verifique se o evento é um merge
    if (payload.ref === 'refs/heads/main' && payload.action === 'merged') {
        console.log('Merge detectado. Executando deploy...');

        exec('powershell -File /cpath/to/deploy_raspberry.ps1', (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao executar o script: ${stderr}`);
                res.status(500).send('Erro no deploy');
                return;
            }
            console.log(stdout);
            res.send('Deploy bem-sucedido!');
        });
    } else {
        console.log('Evento não é um merge em main. Ignorando...');
        res.status(204).send();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
