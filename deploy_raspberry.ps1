# Script de deploy em PowerShell para enviar o projeto via SCP para o Raspberry Pi

param (
    [string]$RaspberryPiIP,
    [string]$Username,
    [string]$Password,
    [string]$SourcePath = ".",
    [string]$DestinationPath = "/home/$Username/fazendinha"
)

# Configurações do SCP
$scpCommand = "scp -r $SourcePath $Username@$RaspberryPiIP:$DestinationPath"

# Executa o comando SCP
Invoke-Expression $scpCommand

if ($LASTEXITCODE -eq 0) {
    Write-Output "Deploy bem-sucedido!"
} else {
    Write-Output "Erro no deploy. Código de saída: $LASTEXITCODE"
}
