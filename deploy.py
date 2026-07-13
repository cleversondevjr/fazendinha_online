import sys
import subprocess

def run_command(command):
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0 and "nothing to commit" not in result.stderr:
        print(f"Erro ao executar comando: {command}")
        print(result.stderr)
        exit(1)
    return result.stdout.strip()

def commit_and_push(message):
    run_command("git add .")
    try:
        run_command(f'git commit -m "{message}"')
    except Exception as e:
        print(f"Erro ao executar git commit: {e}")
    run_command("git push origin main")

def run_powershell_script():
    run_command('powershell.exe -ExecutionPolicy Bypass -File .\\deploy_raspberry.ps1')

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python deploy.py <mensagem-do-commit>")
        exit(1)

    message = sys.argv[1]
    commit_and_push(message)
    run_powershell_script()
