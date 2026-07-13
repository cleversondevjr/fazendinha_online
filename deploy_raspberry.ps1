# Configurações do Servidor
$RaspberryPiIP = "192.168.0.217"
$Username = "pi"
$RemotePath = "/home/pi/fazendinha"

Write-Host "Iniciando deploy para o Raspberry Pi ($RaspberryPiIP)..." -ForegroundColor Cyan

# Pede as credenciais de forma nativa e segura no Windows
$Credential = Get-Credential -UserName $Username -Message "Wincster194060le"
$PasswordPlain = $Credential.GetNetworkCredential().Password

# Executa o SCP usando o utilitário nativo do Windows OpenSSH
# Enviamos os arquivos da pasta atual para o servidor
Write-Host "Transferindo arquivos via SCP..." -ForegroundColor Yellow
scp -r ./* "${Username}@${RaspberryPiIP}:${RemotePath}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy concluído com sucesso total!" -ForegroundColor Green
} else {
    Write-Host "Ocorreu um erro durante a transferência do SCP. Verifique a conexão ou a pasta de destino." -ForegroundColor Red
}
