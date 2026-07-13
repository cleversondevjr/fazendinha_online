import sys
import subprocess

def run_command(command, ignore_errors=False):
    print(f"Executando: {command}")
    result = subprocess.run(command, shell=True, text=True, capture_output=True)
    
    # Se o Git avisar que não há nada para salvar, não é um erro real, ignoramos.
    if "nothing to commit" in result.stdout or "working tree clean" in result.stdout:
        print("Aviso do Git: Nada para salvar localmente, continuando o fluxo...")
        return True
        
    if result.returncode != 0 and not ignore_errors:
        print(f"Erro ao executar comando: {command}")
        print(f"Detalhes do erro: {result.stderr}")
        return False
    return True

def commit_and_push(message):
    if not run_command("git add ."):
        return False
    # Aqui permitimos que o commit passe mesmo se retornar aviso do Git
    run_command(f'git commit -m "{message}"', ignore_errors=True)
    if not run_command("git push origin main", ignore_errors=True):
        print("Aviso: Falha ao enviar para o GitHub, mas prosseguindo com o deploy local...")
    return True

def run_powershell_script():
    run_command('powershell.exe -ExecutionPolicy Bypass -File .\\deploy_raspberry.ps1')

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python deploy.py <mensagem-do-commit>")
        exit(1)
        
    message = sys.argv[1]
    commit_and_push(message)
    run_powershell_script()
