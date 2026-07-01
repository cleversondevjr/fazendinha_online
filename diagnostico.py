import os
import sys
import subprocess
import json

def check_env():
    print("[1] Verificando arquivo .env...")
    env_path = "server/.env"
    if not os.path.exists(env_path):
        print("  - FALHA: server/.env não encontrado. Use server/.env.example como base.")
        return False

    with open(env_path, 'r') as f:
        lines = f.readlines()
        keys = [line.split('=')[0].strip() for line in lines if '=' in line]

    required_keys = ["PGHOST", "PGUSER", "PGDATABASE", "PGPORT", "PORT"]
    missing = [k for k in required_keys if k not in keys]

    if missing:
        print(f"  - FALHA: Chaves faltando no .env: {', '.join(missing)}")
        return False

    print("  - OK: Arquivo .env configurado.")
    return True

def check_node():
    print("[2] Verificando Node.js e Dependências...")
    try:
        node_version = subprocess.check_output(["node", "-v"]).decode().strip()
        print(f"  - OK: Node.js {node_version} instalado.")
    except Exception:
        print("  - FALHA: Node.js não encontrado.")
        return False

    if not os.path.exists("server/node_modules"):
        print("  - AVISO: node_modules não encontrado no server. Rode 'npm install'.")
    else:
        print("  - OK: Dependências do backend parecem estar instaladas.")
    return True

def check_frontend_paths():
    print("[3] Verificando caminhos do Frontend...")
    if not os.path.exists("index.html"):
        print("  - FALHA: index.html não encontrado.")
        return False

    with open("index.html", 'r') as f:
        content = f.read()
        if '<base href="/fazendinha/">' not in content:
            print("  - AVISO: <base href='/fazendinha/'> não encontrado no index.html. Isso pode causar erro nas rotas.")
        else:
            print("  - OK: Tag <base> configurada corretamente.")

    print("  - OK: Arquivos estáticos verificados.")
    return True

def main():
    print("=== Diagnóstico de Deploy - Fazendinha Online ===\n")
    success = True

    if not check_env(): success = False
    print()
    if not check_node(): success = False
    print()
    if not check_frontend_paths(): success = False
    print()

    if success:
        print("=== TUDO PRONTO PARA O DEPLOY! ===")
        print("Para colocar online:")
        print("1. Certifique-se que o Postgres está rodando.")
        print("2. Execute as migrações: psql -U seu_usuario -d seu_banco -f migrations/full_deploy.sql")
        print("3. No diretório server: pm2 start index.js --name fazendinha-backend")
    else:
        print("=== EXISTEM PENDÊNCIAS. CORRIJA OS ITENS ACIMA. ===")

if __name__ == "__main__":
    main()
