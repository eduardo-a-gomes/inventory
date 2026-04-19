param(
    [switch]$SkipSmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

Write-Host ""
Write-Host "==> 1/6 Sincronizar dependencias Python do backend..."
uv sync --project backend --link-mode=copy

Write-Host ""
Write-Host "==> 2/6 Garantir dependencias do frontend..."
npm.cmd --prefix frontend install

Write-Host ""
Write-Host "==> 3/6 Compilar frontend..."
npm.cmd --prefix frontend run build

Write-Host ""
Write-Host "==> 4/6 Limpar builds anteriores..."
if (Test-Path build) {
    Remove-Item build -Recurse -Force
}
if (Test-Path "dist\\InventarioOficina") {
    Remove-Item "dist\\InventarioOficina" -Recurse -Force
}

Write-Host ""
Write-Host "==> 5/6 Gerar executavel com PyInstaller..."
uv run --project backend --with pyinstaller pyinstaller --noconfirm --clean inventario_oficina.spec

$exePath = Join-Path $repoRoot "dist\\InventarioOficina\\InventarioOficina.exe"
if (-not (Test-Path $exePath)) {
    throw "O executavel nao foi gerado em $exePath"
}

if (-not $SkipSmokeTest) {
    Write-Host ""
    Write-Host "==> 6/6 Validar executavel..."
    & $exePath --smoke-test
    if ($LASTEXITCODE -ne 0) {
        throw "O smoke test do executavel falhou com exit code $LASTEXITCODE."
    }
}

$zipPath = Join-Path $repoRoot "dist\\InventarioOficina-portatil.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $repoRoot "dist\\InventarioOficina") -DestinationPath $zipPath

Write-Host ""
Write-Host "Executavel pronto:"
Write-Host "  $exePath"
Write-Host ""
Write-Host "Pacote para entregar/copiar:"
Write-Host "  $zipPath"
