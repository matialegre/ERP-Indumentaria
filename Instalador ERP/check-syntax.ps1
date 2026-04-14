$errors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile(
    'x:\ERP MUNDO OUTDOOR\Instalador ERP\instalar-erp.ps1',
    [ref]$null,
    [ref]$errors
)
if ($errors.Count -eq 0) {
    Write-Host "OK: sin errores de sintaxis"
} else {
    $errors | ForEach-Object { Write-Host "ERROR linea $($_.Extent.StartLineNumber): $($_.Message)" }
}
