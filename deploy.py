import sys
import subprocess

def run_command(command, ignore_errors=False):
    print(f"Executando: {command}")
    result = subprocess.run(command, shell=True, text=True, capture_output=True, encoding='utf-8', errors='ignore')
    stdout_str = result.stdout or ""
    stderr_str = result.stderr or ""
    if "nothing to commit" in stdout_str or "working tree clean" in stdout_str:
        print("Aviso do Git: Nada para salvar localmente, continuando o fluxo...")
        return True
    if result.returncode != 0 and not ignore_errors:
        print(f"Erro ao executar comando: {command}")
        return False
    return True

def commit_and_push(message):
    if not run_command("git add ."): return False
    run_command(f'git commit -m "{message}"', ignore_errors=True)
    run_command("git push origin main", ignore_errors=True)
    return True

def run_powershell_script():
    subprocess.run('powershell.exe -ExecutionPolicy Bypass -File .\\deploy_raspberry.ps1', shell=True)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python deploy.py <mensagem-do-commit>")
        exit(1)
    message = sys.argv[1]
    commit_and_push(message)
    run_powershell_script()
