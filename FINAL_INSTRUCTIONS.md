# Guia Rápido: Colocando o Site Online

Para que o site funcione agora no seu Raspberry Pi, siga estes 3 passos:

### 1. Configurar o Nginx
Copie o conteúdo de `nginx.conf.example` para o seu arquivo de configuração do Nginx (normalmente em `/etc/nginx/sites-available/default`).

**Comando:**
```bash
sudo nano /etc/nginx/sites-available/default
```
(Cole o conteúdo do arquivo nginx.conf.example)

**Reinicie o Nginx:**
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### 2. Reiniciar o Backend (Porta 3002)
Certifique-se de que o backend está usando as novas configurações de CORS.

**Comandos:**
```bash
cd /home/pi/fazendinha_online/server
npm install
pm2 restart fazendinha-backend || pm2 start index.js --name "fazendinha-backend"
```

### 3. Acesso
Abra no seu navegador:
[https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/)
(Não esqueça da barra "/" no final)

---
**Nota:** Verifiquei via terminal que o seu servidor já está respondendo corretamente à API. Se você seguir os passos acima, o site deve abrir visualmente agora.
