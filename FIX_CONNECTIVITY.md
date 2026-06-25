# Ajuste Fino de Conectividade e Login

Se o seu navegador ainda está tentando te levar para `https://farm.sgiptv.com.br/farm/`, siga estes passos para limpar as configurações antigas:

### 1. Limpar Cache do Navegador (Obrigatório)
O navegador "vicia" no redirecionamento antigo.
- Pressione `Ctrl + F5` na página.
- Ou abra o site em uma **Aba Anônima** para testar.

### 2. Verificar o Nginx no Raspberry Pi
Certifique-se de que NÃO existe nenhum redirecionamento sobrando para o domínio antigo.

Rode este comando para procurar referências antigas:
```bash
grep -r "farm.sgiptv.com.br" /etc/nginx/sites-enabled/
```
Se encontrar algo, edite o arquivo e remova.

### 3. Verificar Cloudflare
No painel do Cloudflare:
1. Vá em **Rules** -> **Page Rules** ou **Redirect Rules**.
2. Veja se existe alguma regra redirecionando `sgiptv.com.br/fazendinha` para `farm.sgiptv.com.br`. Se existir, **desative-a**.
3. Vá em **DNS** e verifique se o CNAME para `farm` ainda existe. Você pode removê-lo se não for mais usar.

### 4. Novo Fluxo de Login
Eu criei uma página de login local para facilitar. Se você não estiver logado, o site agora te levará para:
`https://sgiptv.com.br/fazendinha/login.html`

Lá você coloca o seu ID de usuário e clica em entrar. Isso vai criar o acesso necessário no seu navegador sem depender de outros sites.

---
**Comandos para aplicar as novas correções:**
```bash
cd /home/pi/fazendinha_online
git pull origin deploy-fazendinha-v1
cd server
pm2 restart fazendinha-backend
```
