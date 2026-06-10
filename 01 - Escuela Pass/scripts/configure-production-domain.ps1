# Configura variables de producción para escuelapass.com (Railway + referencia Vercel).
# Requiere: railway login && railway link (desde la raíz "01 - Escuela Pass").

$ErrorActionPreference = 'Stop'

$RailwayApi = 'https://escuelapass-seguridad-institucional-production.up.railway.app'
$CorsOrigin = 'https://escuelapass.com,https://www.escuelapass.com,https://escuela-pass-seguridad-instituciona-ashen.vercel.app'
$FrontendUrl = 'https://escuelapass.com'

Write-Host 'Escuela Pass — dominio custom escuelapass.com'
Write-Host ''
Write-Host 'Railway (backend):'
Write-Host "  CORS_ORIGIN=$CorsOrigin"
Write-Host "  FRONTEND_URL=$FrontendUrl"
Write-Host ''
Write-Host 'Vercel (frontend):'
Write-Host "  VITE_API_BASE=$RailwayApi"
Write-Host '  → Redeploy obligatorio tras cambiar VITE_*'
Write-Host ''

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Warning 'Railway CLI no instalado. Configura las variables manualmente en el dashboard.'
  exit 0
}

$whoami = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Railway CLI no autenticado. Ejecuta: railway login'
  Write-Host 'Luego vuelve a ejecutar este script o pega las variables en Railway → Variables.'
  exit 1
}

railway variables set "CORS_ORIGIN=$CorsOrigin" "FRONTEND_URL=$FrontendUrl"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Variables Railway actualizadas. El servicio se reiniciará automáticamente.'
