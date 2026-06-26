# Guia de Comandos: Atualização e Backup

Siga as sequências abaixo para manter seu servidor e seu backup local sempre atualizados com as últimas melhorias (v1.0.3 + Painel Admin Total).

---

### 1. Atualização Normal (Raspberry Pi)
Use este comando quando quiser apenas puxar as novidades do dia.
```bash
cd /home/pi/fazendinha_online
git fetch origin
git checkout main
git pull origin main
cd server
npm install
pm2 restart fazendinha-backend
pm2 save
```

### 2. Limpeza Profunda / Hard Reset (Raspberry Pi)
Use este comando se os arquivos não estiverem subindo ou se houver erro de conflito no Git. **Isso forçará o servidor a ficar idêntico ao repositório.**
```bash
cd /home/pi/fazendinha_online
git fetch origin
git reset --hard origin/main
cd server
npm install
pm2 restart fazendinha-backend
sudo nginx -t && sudo systemctl restart nginx
```

### 3. Backup e Atualização Local (PC Windows)
Para manter sua pasta `F:\projetos\fazendinha_online` atualizada como um backup seguro.
Abra o **PowerShell** ou **Git Bash** no seu PC e execute:
```powershell
# Entrar na pasta do projeto
cd F:\projetos\fazendinha_online

# Puxar as atualizações do GitHub
git fetch origin
git pull origin main

# Confirmar versão v1.0.3 no código
git log -n 1
```

---

### 🔍 Verificação de Sucesso
1.  **No Navegador**: Abra [https://sgiptv.com.br/fazendinha/](https://sgiptv.com.br/fazendinha/) em aba anônima.
2.  **Versão**: Verifique se aparece **v1.0.3** abaixo da logo.
3.  **Painel Admin**: Teste as novas abas (Conta, Slots, Plantas).
