# Configurações do Servidor
$RaspberryPiIP = "192.168.0.217"
$Username = "pi"
$RemotePath = "/home/pi/fazendinha"

Write-Host "Iniciando deploy para o Raspberry Pi ($RaspberryPiIP)..." -ForegroundColor Cyan

# Executa o SCP de forma nativa. O próprio terminal pedirá a senha se necessário.
Write-Host "Transferindo arquivos via SCP..." -ForegroundColor Yellow
scp -r ./* "${Username}@${RaspberryPiIP}:${RemotePath}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Transferência concluída! Reiniciando o servidor no Raspberry Pi..." -ForegroundColor Yellow
    
    # Executa a reinicialização direta via SSH de forma nativa
    ssh "${Username}@${RaspberryPiIP}" "cd ${RemotePath} && (pm2 restart all || (pkill -f server.js; nohup node server.js > server.log 2>&1 &))"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deploy e reinicialização concluídos com sucesso total! O jogo está atualizado." -ForegroundColor Green
    } else {
        Write-Host "Arquivos enviados, mas houve um problema ao reiniciar o servidor via SSH." -ForegroundColor Yellow
    }
} else {
    Write-Host "Ocorreu um erro durante a transferência do SCP. Verifique a conexão." -ForegroundColor Red
}
