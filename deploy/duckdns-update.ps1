# DuckDNS Auto-Update — corre cada 5 min via Task Scheduler
# CONFIGURAR: cambiar TOKEN y SUBDOMAIN antes de usar

$TOKEN    = "TU-TOKEN-AQUI"       # Token de duckdns.org/account
$SUBDOMAIN = "mundooutdoor"       # Subdomain elegido (mundooutdoor.duckdns.org)
$LOGFILE  = "$PSScriptRoot\duckdns-update.log"

try {
    $response = Invoke-RestMethod -Uri "https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$TOKEN&ip=" -TimeoutSec 10
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LOGFILE -Value "$timestamp | $response"
    if ($response -like "OK*") {
        Write-Host "✅ DuckDNS actualizado: $SUBDOMAIN.duckdns.org"
    } else {
        Write-Host "⚠️ DuckDNS respuesta: $response"
    }
} catch {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LOGFILE -Value "$timestamp | ERROR: $_"
    Write-Host "❌ Error actualizando DuckDNS: $_"
}
