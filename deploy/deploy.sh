#!/usr/bin/env bash
# ─── Script de despliegue — ERP Mundo Outdoor ───
# Uso: bash deploy/deploy.sh
# Ejecutar desde la raíz del proyecto (D:\ERP MUNDO OUTDOOR o /opt/erp)

set -euo pipefail

# ── Colores para output ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Verificar que estamos en el directorio correcto ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

log "Directorio del proyecto: $PROJECT_ROOT"

# ── Paso 1: Verificar dependencias ────────────────────────────────────────────
log "Verificando dependencias..."
command -v docker >/dev/null 2>&1       || error "Docker no está instalado"
command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || error "Docker Compose no está instalado"
command -v node >/dev/null 2>&1         || error "Node.js no está instalado"
command -v npm >/dev/null 2>&1          || error "npm no está instalado"

# Detectar si usar 'docker-compose' o 'docker compose'
if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
else
    DC="docker compose"
fi

# ── Paso 2: Cargar variables de entorno ────────────────────────────────────────
if [ -f deploy/.env ]; then
    log "Cargando variables desde deploy/.env"
    set -a
    source deploy/.env
    set +a
else
    warn "No se encontró deploy/.env — usando valores por defecto"
    warn "Copiá deploy/.env.example a deploy/.env y ajustá los valores"
fi

# ── Paso 3: Build del frontend ─────────────────────────────────────────────────
log "Construyendo frontend (React + Vite)..."
cd erp/frontend

if [ ! -d "node_modules" ]; then
    log "Instalando dependencias del frontend..."
    npm install --legacy-peer-deps
fi

npm run build || error "Falló el build del frontend"
cd "$PROJECT_ROOT"

log "Frontend buildeado → erp/frontend/dist/"

# ── Paso 4: Build de imágenes Docker ──────────────────────────────────────────
log "Construyendo imágenes Docker..."
$DC -f deploy/docker-compose.yml build --no-cache || error "Falló el build de Docker"

# ── Paso 5: Levantar servicios ─────────────────────────────────────────────────
log "Levantando servicios..."
$DC -f deploy/docker-compose.yml up -d || error "Falló al levantar los servicios"

# ── Paso 6: Esperar a que la base de datos esté lista ──────────────────────────
log "Esperando a que PostgreSQL esté listo..."
RETRIES=30
until $DC -f deploy/docker-compose.yml exec -T db pg_isready -U "${POSTGRES_USER:-erp_user}" -d "${POSTGRES_DB:-erp_mundooutdoor}" >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        error "PostgreSQL no respondió después de 30 intentos"
    fi
    sleep 2
done
log "PostgreSQL listo ✓"

# ── Paso 7: Ejecutar migraciones Alembic ───────────────────────────────────────
log "Ejecutando migraciones de base de datos..."
$DC -f deploy/docker-compose.yml exec -T backend alembic upgrade head || warn "Migraciones fallaron (puede ser normal en primera ejecución)"

# ── Paso 8: Health check ──────────────────────────────────────────────────────
log "Verificando salud del sistema..."
sleep 5

HEALTH_URL="http://localhost:8000/health"
HEALTH_RESPONSE=$(curl -sf "$HEALTH_URL" 2>/dev/null || echo "FAIL")

if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
    log "Health check OK ✓"
else
    warn "Health check falló — revisá los logs: $DC -f deploy/docker-compose.yml logs backend"
fi

# Health check del endpoint de sistema
API_HEALTH="http://localhost:8000/api/v1/system/health"
API_RESPONSE=$(curl -sf "$API_HEALTH" 2>/dev/null || echo "FAIL")
if echo "$API_RESPONSE" | grep -q '"status"'; then
    log "API system health OK ✓"
else
    warn "API system health no responde — puede que el router no esté registrado aún"
fi

# ── Resumen ────────────────────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════════════"
log "  Despliegue completado"
log "═══════════════════════════════════════════════════"
log "  Frontend:  http://localhost (nginx)"
log "  Backend:   http://localhost:8000"
log "  API docs:  http://localhost:8000/docs"
log "  DB:        localhost:${POSTGRES_PORT:-2048}"
log ""
log "  Logs:  $DC -f deploy/docker-compose.yml logs -f"
log "  Stop:  $DC -f deploy/docker-compose.yml down"
log "═══════════════════════════════════════════════════"
