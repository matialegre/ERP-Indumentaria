#!/usr/bin/env bash
# ─── Script de backup de base de datos — ERP Mundo Outdoor ───
# Uso: bash deploy/backup.sh
# Cron recomendado: 0 3 * * * cd /opt/erp && bash deploy/backup.sh
# Hace un dump completo y retiene los últimos 30 backups.

set -euo pipefail

# ── Configuración ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
MAX_BACKUPS=30

# Datos de conexión (sobreescribibles con .env)
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

DB_NAME="${POSTGRES_DB:-erp_mundooutdoor}"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-2048}"

# Timestamp para el nombre del archivo
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ── Funciones ──────────────────────────────────────────────────────────────────
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# ── Crear directorio de backups si no existe ───────────────────────────────────
mkdir -p "$BACKUP_DIR"

log "════════ Inicio de backup ════════"
log "Base de datos: $DB_NAME"
log "Host: $DB_HOST:$DB_PORT"

# ── Detectar si usar Docker o pg_dump local ────────────────────────────────────
if command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1; then
    # Intentar via Docker primero
    if command -v docker-compose >/dev/null 2>&1; then
        DC="docker-compose"
    else
        DC="docker compose"
    fi

    # Verificar que el contenedor de DB esté corriendo
    if $DC -f "$SCRIPT_DIR/docker-compose.yml" ps db 2>/dev/null | grep -q "Up\|running"; then
        log "Usando pg_dump desde contenedor Docker..."
        $DC -f "$SCRIPT_DIR/docker-compose.yml" exec -T db \
            pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
            | gzip > "$BACKUP_FILE"
    elif command -v pg_dump >/dev/null 2>&1; then
        log "Contenedor Docker no activo. Usando pg_dump local..."
        PGPASSWORD="${POSTGRES_PASSWORD:-MundoOutdoor2026!}" pg_dump \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-owner --no-privileges \
            | gzip > "$BACKUP_FILE"
    else
        log "ERROR: No se puede acceder a la base de datos (ni Docker ni pg_dump local)"
        exit 1
    fi
elif command -v pg_dump >/dev/null 2>&1; then
    log "Usando pg_dump local..."
    PGPASSWORD="${POSTGRES_PASSWORD:-MundoOutdoor2026!}" pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-privileges \
        | gzip > "$BACKUP_FILE"
else
    log "ERROR: No se encontró pg_dump ni Docker. Instalá PostgreSQL client o Docker."
    exit 1
fi

# ── Verificar que el backup se creó correctamente ──────────────────────────────
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup creado: $BACKUP_FILE ($FILESIZE)"
else
    log "ERROR: El backup está vacío o no se creó"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ── Rotación: conservar solo los últimos N backups ─────────────────────────────
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | wc -l)
log "Backups existentes: $BACKUP_COUNT (máximo: $MAX_BACKUPS)"

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
    log "Eliminando $EXCESS backup(s) antiguo(s)..."
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f \
        | sort \
        | head -n "$EXCESS" \
        | while read -r old_backup; do
            log "  Eliminado: $(basename "$old_backup")"
            rm -f "$old_backup"
        done
fi

log "════════ Backup completado ════════"
log ""
