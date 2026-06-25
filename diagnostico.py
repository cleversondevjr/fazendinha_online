import os
import subprocess
import re

def run_command(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT).decode('utf-8')
    except Exception as e:
        return str(e)

print("=== DIAGNÓSTICO DE REDIRECIONAMENTO - FAZENDINHA ===")

# 1. Procurar no Nginx
print("\n[1] Procurando domínio antigo no Nginx...")
nginx_search = run_command('sudo grep -r "farm.sgiptv.com.br" /etc/nginx/')
if "farm.sgiptv.com.br" in nginx_search:
    print("ACHADO NO NGINX!")
    print(nginx_search)
else:
    print("Nada encontrado nas configs do Nginx.")

# 2. Verificar processos na porta 3002 e 80
print("\n[2] Verificando portas...")
print("Porta 3002 (Backend):")
print(run_command('sudo lsof -i :3002'))
print("Porta 80 (Nginx):")
print(run_command('sudo lsof -i :80'))

# 3. Verificar PM2
print("\n[3] Processos no PM2:")
print(run_command('pm2 list'))

# 4. Verificar conteúdo da pasta servida
print("\n[4] Verificando arquivos em /home/pi/fazendinha_online:")
if os.path.exists('/home/pi/fazendinha_online/index.html'):
    with open('/home/pi/fazendinha_online/index.html', 'r') as f:
        content = f.read()
        if 'base href' in content:
            print("index.html parece atualizado (tem 'base href').")
        else:
            print("AVISO: index.html parece ANTIGO (não tem 'base href')!")
else:
    print("ERRO: index.html não encontrado no caminho esperado!")

# 5. Procurar em TODA a pasta home por scripts de redirecionamento
print("\n[5] Procurando redirecionamentos ocultos nos arquivos JS/HTML...")
grep_home = run_command('grep -r "location.href" /home/pi/fazendinha_online/ --exclude-dir=node_modules')
print(grep_home)

print("\n=== FIM DO DIAGNÓSTICO ===")
