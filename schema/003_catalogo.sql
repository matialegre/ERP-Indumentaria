-- ============================================================
-- 003_catalogo.sql — Productos, variantes y stock
-- Compatible: SQLite + PostgreSQL (diferencias anotadas)
-- ============================================================

-- PRODUCTOS
-- Producto "padre" — define el artículo base.
-- Las variantes (talle/color) están en variantes_producto.
-- Un producto SIN variantes es válido (producto simple).
CREATE TABLE productos (
    id              TEXT PRIMARY KEY,            -- UUID v4
    empresa_id      TEXT NOT NULL REFERENCES empresas(id),
    nombre          TEXT NOT NULL,
    sku             TEXT,                        -- código interno, único por empresa
    descripcion     TEXT,
    categoria       TEXT,                        -- categoría libre (futuro: tabla aparte)
    marca           TEXT,
    temporada       TEXT,                        -- ej: 'Invierno 2026', 'Permanente'
    variante_tipo   TEXT,                        -- qué tipo de variantes tiene:
                                                --   NULL = producto simple (sin variantes)
                                                --   'talle' = solo talles
                                                --   'color' = solo colores
                                                --   'talle_color' = matriz talle × color
    precio_costo    REAL,                       -- precio de compra (último conocido)
    precio_venta    REAL,                       -- precio de venta sugerido
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: usar NUMERIC(12,2) en lugar de REAL para precios

CREATE UNIQUE INDEX idx_productos_sku_empresa ON productos(empresa_id, sku)
    WHERE sku IS NOT NULL;
CREATE INDEX idx_productos_empresa ON productos(empresa_id);
CREATE INDEX idx_productos_nombre ON productos(empresa_id, nombre);
CREATE INDEX idx_productos_categoria ON productos(empresa_id, categoria);
CREATE INDEX idx_productos_activo ON productos(empresa_id, activo);

-- VARIANTES_PRODUCTO
-- Cada fila es una combinación específica (ej: "Campera Andes / Talle L / Rojo").
-- atributos_json guarda los atributos de forma flexible:
--   {"talle": "L", "color": "Rojo", "color_hex": "#FF0000"}
-- stock_actual es un campo desnormalizado que se actualiza con cada movimiento.
CREATE TABLE variantes_producto (
    id              TEXT PRIMARY KEY,            -- UUID v4
    producto_id     TEXT NOT NULL REFERENCES productos(id),
    atributos_json  TEXT NOT NULL DEFAULT '{}',  -- JSON con los atributos de la variante
    sku_variante    TEXT,                        -- SKU específico de la variante
    codigo_barras   TEXT,                        -- EAN/UPC para scanner
    stock_actual    INTEGER NOT NULL DEFAULT 0,  -- desnormalizado, se recalcula periódicamente
    stock_minimo    INTEGER DEFAULT 0,           -- para alertas de reposición
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: usar JSONB para atributos_json

CREATE INDEX idx_variantes_producto ON variantes_producto(producto_id);
CREATE INDEX idx_variantes_barcode ON variantes_producto(codigo_barras)
    WHERE codigo_barras IS NOT NULL;
CREATE INDEX idx_variantes_sku ON variantes_producto(sku_variante)
    WHERE sku_variante IS NOT NULL;

-- MOVIMIENTOS_STOCK
-- Registro inmutable de cada cambio en stock.
-- stock_actual en variantes_producto es un cache; esta tabla es la fuente de verdad.
-- Cada movimiento genera un evento_sync automáticamente.
CREATE TABLE movimientos_stock (
    id              TEXT PRIMARY KEY,            -- UUID v4
    variante_id     TEXT NOT NULL REFERENCES variantes_producto(id),
    empresa_id      TEXT NOT NULL REFERENCES empresas(id),
    tipo            TEXT NOT NULL                -- tipo de movimiento
                    CHECK (tipo IN (
                        'INGRESO',              -- mercadería que entra (compra, devolución cliente)
                        'EGRESO',               -- mercadería que sale (venta, devolución proveedor)
                        'AJUSTE',               -- corrección manual de inventario
                        'TRANSFERENCIA_IN',     -- recepción desde otro local
                        'TRANSFERENCIA_OUT'     -- envío a otro local
                    )),
    cantidad        INTEGER NOT NULL,           -- siempre positivo; el tipo indica dirección
    stock_resultante INTEGER NOT NULL,          -- stock después del movimiento (para auditoría)
    motivo          TEXT,                        -- descripción libre
    referencia_tipo TEXT,                        -- 'ingreso', 'venta', 'ajuste', 'transferencia'
    referencia_id   TEXT,                        -- UUID del documento origen
    local_id        TEXT,                        -- local donde ocurrió (futuro FK a locales)
    usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
    dispositivo_id  TEXT REFERENCES dispositivos(id),
    timestamp_local TEXT NOT NULL,               -- cuándo ocurrió en el dispositivo
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_movstock_variante ON movimientos_stock(variante_id);
CREATE INDEX idx_movstock_empresa ON movimientos_stock(empresa_id);
CREATE INDEX idx_movstock_tipo ON movimientos_stock(empresa_id, tipo);
CREATE INDEX idx_movstock_fecha ON movimientos_stock(empresa_id, timestamp_local);
CREATE INDEX idx_movstock_referencia ON movimientos_stock(referencia_tipo, referencia_id)
    WHERE referencia_id IS NOT NULL;
CREATE INDEX idx_movstock_local ON movimientos_stock(local_id)
    WHERE local_id IS NOT NULL;
