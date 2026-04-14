-- ============================================================
-- 001_empresas.sql — Core multi-tenant: empresas, usuarios, dispositivos
-- Compatible: SQLite + PostgreSQL (diferencias anotadas)
-- ============================================================

-- EMPRESAS
-- Cada empresa es un tenant aislado. Toda data de negocio
-- se scopa a una empresa vía empresa_id.
CREATE TABLE empresas (
    id          TEXT PRIMARY KEY,            -- UUID v4
    nombre      TEXT NOT NULL,
    rubro       TEXT,                        -- ej: 'indumentaria', 'outdoor'
    config_json TEXT DEFAULT '{}',           -- JSON: configuraciones por empresa
                                            --   moneda, timezone, logo_url, etc.
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: usar TIMESTAMPTZ en lugar de TEXT para created_at/updated_at
-- Nota PostgreSQL: usar JSONB en lugar de TEXT para config_json

-- USUARIOS
-- Un usuario puede pertenecer a múltiples empresas (vía usuario_empresa).
-- El password_hash se genera con bcrypt.
CREATE TABLE usuarios (
    id              TEXT PRIMARY KEY,        -- UUID v4
    nombre          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_usuarios_email ON usuarios(email);

-- USUARIO_EMPRESA
-- Relación N:N entre usuarios y empresas.
-- Un usuario puede tener un rol distinto en cada empresa.
-- Roles posibles: SUPERADMIN, ADMIN, COMPRAS, ADMINISTRACION,
--                 GESTION_PAGOS, LOCAL, VENDEDOR, DEPOSITO
CREATE TABLE usuario_empresa (
    usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
    empresa_id  TEXT NOT NULL REFERENCES empresas(id),
    rol         TEXT NOT NULL DEFAULT 'VENDEDOR',
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (usuario_id, empresa_id)
);

CREATE INDEX idx_usuario_empresa_empresa ON usuario_empresa(empresa_id);
CREATE INDEX idx_usuario_empresa_rol ON usuario_empresa(rol);

-- DISPOSITIVOS
-- Cada dispositivo físico (PC, tablet, celular) se registra
-- para poder trackear sync y permisos por device.
CREATE TABLE dispositivos (
    id              TEXT PRIMARY KEY,        -- UUID v4, generado en el dispositivo
    empresa_id      TEXT NOT NULL REFERENCES empresas(id),
    nombre          TEXT NOT NULL,           -- ej: 'Tablet Local Centro', 'PC Depósito'
    tipo            TEXT,                    -- 'pc', 'tablet', 'celular'
    ultimo_sync     TEXT,                    -- timestamp del último sync exitoso
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_dispositivos_empresa ON dispositivos(empresa_id);
