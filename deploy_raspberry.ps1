param (
    [string]$RaspberryPiIP = "192.168.0.217",
    [string]$Username = "pi",
    [string]$SourcePath = ".",
    [string]$DestinationPath = "/home/pi/fazendinha"
)

if (-not $RaspberryPiIP -or -not $Username -or -not $SourcePath -or -not $DestinationPath) {
    Write-Host "Uso: .\deploy_raspberry.ps1 -RaspberryPiIP <ip-do-raspberrypi> -Username <usuario> -SourcePath <caminho-fonte> -DestinationPath <caminho-destino>" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando deploy para o Raspberry Pi ($RaspberryPiIP)..." -ForegroundColor Cyan

# Cria uma sessão SSH pedindo a senha de forma nativa e segura no PowerShell
$passwordSecure = Read-Host "Digite a senha para $Username@$RaspberryPiIP" -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential($Username, $passwordSecure)

# Executa o SCP usando o cliente OpenSSH do Windows
# Nota: Como o SCP padrão do Windows não aceita a senha na linha de comando por segurança,
# este script vai disparar a janela do OpenSSH para você colar a sua senha 'Wincster@...' com segurança.
$scpCommand = "scp -r `"$SourcePath`" $Username@${RaspberryPiIP}:${DestinationPath}"

Invoke-Expression $scpCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy bem-sucedido na pasta /home/pi/fazendinha!" -ForegroundColor Green
} else {
    Write-Host "Erro no deploy. Código de saída: $LASTEXITCODE" -ForegroundColor Red
}
