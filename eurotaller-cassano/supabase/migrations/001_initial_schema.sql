-- ============================================================
-- ERP Eurotaller Cassano — Schema inicial
-- Caseros, Buenos Aires, Argentina
-- 24 tablas · PostgreSQL / Supabase · Abril 2026
--
-- Instrucciones:
--   1. Ejecutar en Supabase SQL Editor o via CLI:
--      supabase db push
--   2. Todas las tablas tienen RLS habilitado.
--      Las políticas asumen autenticación via Supabase Auth.
--   3. Moneda: ARS decimal(12,2). Timezone: America/Argentina/Buenos_Aires
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SEQUENCES para numeración correlativa (nunca se reinician)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS seq_numero_ot       START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_presupuesto START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_comprobante_a START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_comprobante_b START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_comprobante_c START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_numero_oc       START 1 INCREMENT 1;


-- ============================================================
-- USUARIOS (perfil extendido de auth.users de Supabase)
-- ============================================================
CREATE TABLE usuarios (
    id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      varchar(100) NOT NULL,
    apellido    varchar(100) NOT NULL,
    email       varchar(100) NOT NULL UNIQUE,
    rol         varchar(20)  NOT NULL CHECK (rol IN ('admin','recepcionista','mecanico','contador')),
    activo      boolean      DEFAULT true,
    created_at  timestamptz  DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- admin ve todo, recepcionista ve todo, contador y mecánico solo su propio registro
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid()
            AND u.rol IN ('admin','recepcionista')
        )
    );
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'admin'));
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'admin'));


-- ============================================================
-- TECNICOS
-- ============================================================
CREATE TABLE tecnicos (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      varchar(100) NOT NULL,
    apellido    varchar(100) NOT NULL,
    dni         varchar(15),
    telefono    varchar(30),
    email       varchar(100),
    especialidad varchar(100),
    precio_hora decimal(10,2) DEFAULT 0,
    activo      boolean      DEFAULT true,
    usuario_id  uuid         REFERENCES auth.users(id),  -- NULL si no tiene acceso al sistema
    created_at  timestamptz  DEFAULT now()
);

ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tecnicos_select" ON tecnicos FOR SELECT USING (true);
CREATE POLICY "tecnicos_modify" ON tecnicos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_tecnicos_activo ON tecnicos(activo);


-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                    varchar(20) NOT NULL CHECK (tipo IN ('particular','empresa','flota')),
    nombre                  varchar(200) NOT NULL,
    razon_social            varchar(200),
    cuit_dni                varchar(20),
    condicion_iva           varchar(30) NOT NULL CHECK (condicion_iva IN (
                                'responsable_inscripto','monotributista',
                                'consumidor_final','exento'
                            )),
    telefono                varchar(30),
    email                   varchar(100),
    direccion               text,
    limite_credito          decimal(12,2) DEFAULT 0,
    saldo_cuenta_corriente  decimal(12,2) DEFAULT 0,  -- positivo = nos debe
    notas                   text,
    activo                  boolean DEFAULT true,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (true);
CREATE POLICY "clientes_modify" ON clientes FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_clientes_nombre ON clientes(nombre);
CREATE INDEX ix_clientes_cuit ON clientes(cuit_dni) WHERE cuit_dni IS NOT NULL;
CREATE INDEX ix_clientes_activo ON clientes(activo);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- VEHICULOS
-- ============================================================
CREATE TABLE vehiculos (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id              uuid        NOT NULL REFERENCES clientes(id),
    patente                 varchar(10) NOT NULL UNIQUE,  -- ABC123 o AB123CD
    marca                   varchar(50) NOT NULL,
    modelo                  varchar(100) NOT NULL,
    anio                    integer,
    color                   varchar(30),
    vin                     varchar(20),
    km_ultimo_servicio      integer DEFAULT 0,
    proximo_service_km      integer,
    proximo_service_fecha   date,
    notas                   text,
    activo                  boolean DEFAULT true,
    created_at              timestamptz DEFAULT now()
);

ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehiculos_select" ON vehiculos FOR SELECT USING (true);
CREATE POLICY "vehiculos_modify" ON vehiculos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_vehiculos_cliente ON vehiculos(cliente_id);
CREATE INDEX ix_vehiculos_patente ON vehiculos(patente);
CREATE INDEX ix_vehiculos_marca ON vehiculos(marca);

-- Función de validación de patente argentina (ABC123 o AB123CD)
CREATE OR REPLACE FUNCTION fn_validate_patente(p text)
RETURNS boolean AS $$
BEGIN
    RETURN p ~ '^[A-Z]{3}[0-9]{3}$' OR p ~ '^[A-Z]{2}[0-9]{3}[A-Z]{2}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE vehiculos ADD CONSTRAINT chk_patente_formato
    CHECK (fn_validate_patente(upper(patente)));


-- ============================================================
-- CATEGORIAS_ARTICULOS
-- ============================================================
CREATE TABLE categorias_articulos (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      varchar(100) NOT NULL UNIQUE,
    descripcion text
);

ALTER TABLE categorias_articulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_select" ON categorias_articulos FOR SELECT USING (true);
CREATE POLICY "categorias_modify" ON categorias_articulos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'admin'));


-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE proveedores (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                  varchar(200) NOT NULL,
    razon_social            varchar(200),
    cuit                    varchar(15),
    condicion_iva           varchar(30),
    telefono                varchar(30),
    email                   varchar(100),
    direccion               text,
    condicion_pago_dias     integer DEFAULT 0,
    saldo_cuenta_corriente  decimal(12,2) DEFAULT 0,  -- positivo = les debemos
    notas                   text,
    activo                  boolean DEFAULT true,
    created_at              timestamptz DEFAULT now()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proveedores_select" ON proveedores FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista','contador')));
CREATE POLICY "proveedores_modify" ON proveedores FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_proveedores_nombre ON proveedores(nombre);
CREATE INDEX ix_proveedores_cuit ON proveedores(cuit) WHERE cuit IS NOT NULL;


-- ============================================================
-- ARTICULOS (stock)
-- ============================================================
CREATE TABLE articulos (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                  varchar(30) NOT NULL UNIQUE,
    nombre                  varchar(200) NOT NULL,
    descripcion             text,
    categoria_id            uuid        REFERENCES categorias_articulos(id),
    proveedor_principal_id  uuid        REFERENCES proveedores(id),
    ubicacion_deposito      varchar(50),
    stock_actual            decimal(10,2) DEFAULT 0,
    stock_minimo            decimal(10,2) DEFAULT 1,
    stock_maximo            decimal(10,2),
    unidad_medida           varchar(20) DEFAULT 'unidad'
                            CHECK (unidad_medida IN ('unidad','litro','kg','metro','par','juego','ml','cm')),
    precio_costo_promedio   decimal(12,2) DEFAULT 0,  -- actualizado en cada ingreso (PPP)
    precio_venta            decimal(12,2) DEFAULT 0,
    iva_porcentaje          decimal(5,2) DEFAULT 21.00
                            CHECK (iva_porcentaje IN (0, 10.5, 21.0, 27.0)),
    activo                  boolean DEFAULT true,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articulos_select" ON articulos FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()));
CREATE POLICY "articulos_modify" ON articulos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_articulos_codigo ON articulos(codigo);
CREATE INDEX ix_articulos_nombre ON articulos(nombre);
CREATE INDEX ix_articulos_categoria ON articulos(categoria_id);
CREATE INDEX ix_articulos_stock_bajo ON articulos(stock_actual, stock_minimo)
    WHERE activo = true;

CREATE TRIGGER trg_articulos_updated_at
    BEFORE UPDATE ON articulos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- ORDENES_TRABAJO
-- ============================================================
CREATE TABLE ordenes_trabajo (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_ot               integer     NOT NULL UNIQUE DEFAULT nextval('seq_numero_ot'),
    vehiculo_id             uuid        NOT NULL REFERENCES vehiculos(id),
    cliente_id              uuid        NOT NULL REFERENCES clientes(id),
    tecnico_id              uuid        REFERENCES tecnicos(id),
    turno_id                uuid,       -- FK → turnos se agrega luego (forward ref)
    fecha_ingreso           date        NOT NULL,
    fecha_prometida         date,
    fecha_entrega           date,
    km_ingreso              integer,
    km_egreso               integer,
    descripcion_problema    text        NOT NULL,
    diagnostico             text,
    trabajos_realizados     text,
    estado                  varchar(30) DEFAULT 'recibido'
                            CHECK (estado IN (
                                'recibido',
                                'diagnostico',
                                'esperando_repuestos',
                                'en_reparacion',
                                'listo',
                                'entregado',
                                'cancelado'
                            )),
    subtotal_mano_obra      decimal(12,2) DEFAULT 0,
    subtotal_repuestos      decimal(12,2) DEFAULT 0,
    descuento               decimal(12,2) DEFAULT 0,
    total                   decimal(12,2) DEFAULT 0,
    observaciones           text,
    nombre_archivo_pdf      varchar(200),  -- OT_MARCA_PATENTE_DESC_YYYYMMDD.pdf
    created_by_id           uuid        REFERENCES auth.users(id),
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
-- mecánicos solo ven sus OTs; admin y recepcionista ven todas
CREATE POLICY "ot_select" ON ordenes_trabajo FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista','contador'))
        OR (tecnico_id IN (SELECT id FROM tecnicos WHERE usuario_id = auth.uid()))
    );
CREATE POLICY "ot_modify" ON ordenes_trabajo FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_ot_numero ON ordenes_trabajo(numero_ot);
CREATE INDEX ix_ot_vehiculo ON ordenes_trabajo(vehiculo_id);
CREATE INDEX ix_ot_cliente ON ordenes_trabajo(cliente_id);
CREATE INDEX ix_ot_tecnico ON ordenes_trabajo(tecnico_id);
CREATE INDEX ix_ot_estado ON ordenes_trabajo(estado);
CREATE INDEX ix_ot_fecha ON ordenes_trabajo(fecha_ingreso);

CREATE TRIGGER trg_ot_updated_at
    BEFORE UPDATE ON ordenes_trabajo
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- OT_ITEMS_MANO_OBRA
-- ============================================================
CREATE TABLE ot_items_mano_obra (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id           uuid        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    descripcion     varchar(300) NOT NULL,
    horas           decimal(6,2) DEFAULT 1,
    precio_hora     decimal(12,2) NOT NULL,
    subtotal        decimal(12,2) NOT NULL  -- horas × precio_hora
);

ALTER TABLE ot_items_mano_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ot_mo_select" ON ot_items_mano_obra FOR SELECT USING (true);
CREATE POLICY "ot_mo_modify" ON ot_items_mano_obra FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_ot_mo_ot ON ot_items_mano_obra(ot_id);


-- ============================================================
-- OT_ITEMS_REPUESTOS
-- ============================================================
CREATE TABLE ot_items_repuestos (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id           uuid        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    articulo_id     uuid        REFERENCES articulos(id),  -- NULL si ítem libre
    descripcion     varchar(300) NOT NULL,
    cantidad        decimal(10,2) NOT NULL,
    precio_unitario decimal(12,2) NOT NULL,
    subtotal        decimal(12,2) NOT NULL  -- cantidad × precio_unitario
);

ALTER TABLE ot_items_repuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ot_rep_select" ON ot_items_repuestos FOR SELECT USING (true);
CREATE POLICY "ot_rep_modify" ON ot_items_repuestos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_ot_rep_ot ON ot_items_repuestos(ot_id);
CREATE INDEX ix_ot_rep_articulo ON ot_items_repuestos(articulo_id) WHERE articulo_id IS NOT NULL;


-- ============================================================
-- MOVIMIENTOS_STOCK
-- ============================================================
CREATE TABLE movimientos_stock (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    articulo_id         uuid        NOT NULL REFERENCES articulos(id),
    tipo                varchar(20) NOT NULL
                        CHECK (tipo IN ('ingreso','egreso','ajuste_positivo','ajuste_negativo')),
    cantidad            decimal(10,2) NOT NULL,
    stock_anterior      decimal(10,2) NOT NULL,
    stock_resultante    decimal(10,2) NOT NULL,
    precio_unitario     decimal(12,2),  -- para calcular precio promedio ponderado
    motivo              varchar(100)
                        CHECK (motivo IN ('compra','uso_ot','devolucion','ajuste_inventario','otro') OR motivo IS NULL),
    ot_id               uuid        REFERENCES ordenes_trabajo(id),
    orden_compra_id     uuid,       -- FK → ordenes_compra (forward ref)
    usuario_id          uuid        REFERENCES auth.users(id),
    fecha               date        NOT NULL,
    notas               text,
    created_at          timestamptz DEFAULT now()
);

ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_select" ON movimientos_stock FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()));
CREATE POLICY "stock_modify" ON movimientos_stock FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_stock_articulo ON movimientos_stock(articulo_id);
CREATE INDEX ix_stock_ot ON movimientos_stock(ot_id) WHERE ot_id IS NOT NULL;
CREATE INDEX ix_stock_fecha ON movimientos_stock(fecha);


-- ============================================================
-- VEHICULOS_CHECKLIST (inspección visual al recibir el vehículo)
-- ============================================================
CREATE TABLE vehiculos_checklist (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id               uuid        NOT NULL REFERENCES ordenes_trabajo(id),
    nivel_combustible   varchar(10)
                        CHECK (nivel_combustible IN ('1/4','1/2','3/4','lleno') OR nivel_combustible IS NULL),
    carroceria_estado   text,   -- descripción de golpes/rayaduras
    accesorios          text,   -- radio, gato, llave rueda, etc.
    vidrios_ok          boolean DEFAULT true,
    tapizado_ok         boolean DEFAULT true,
    firma_cliente       text,   -- base64 de firma digital o nombre
    created_at          timestamptz DEFAULT now()
);

ALTER TABLE vehiculos_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_select" ON vehiculos_checklist FOR SELECT USING (true);
CREATE POLICY "checklist_modify" ON vehiculos_checklist FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE UNIQUE INDEX ix_checklist_ot ON vehiculos_checklist(ot_id);


-- ============================================================
-- TURNOS (agenda)
-- ============================================================
CREATE TABLE turnos (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id              uuid        NOT NULL REFERENCES clientes(id),
    vehiculo_id             uuid        NOT NULL REFERENCES vehiculos(id),
    tecnico_id              uuid        REFERENCES tecnicos(id),
    fecha_hora_inicio       timestamptz NOT NULL,
    duracion_estimada_min   integer     DEFAULT 60,
    tipo_servicio           varchar(100),
    descripcion             text,
    estado                  varchar(20) DEFAULT 'confirmado'
                            CHECK (estado IN ('confirmado','presente','ausente','cancelado','completado')),
    ot_id                   uuid        REFERENCES ordenes_trabajo(id),  -- asignado al completarse
    notas                   text,
    created_at              timestamptz DEFAULT now()
);

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "turnos_select" ON turnos FOR SELECT USING (true);
CREATE POLICY "turnos_modify" ON turnos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_turnos_fecha ON turnos(fecha_hora_inicio);
CREATE INDEX ix_turnos_tecnico ON turnos(tecnico_id);
CREATE INDEX ix_turnos_estado ON turnos(estado);

-- Agregar FK de ordenes_trabajo a turnos ahora que turnos existe
ALTER TABLE ordenes_trabajo ADD CONSTRAINT fk_ot_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id);


-- ============================================================
-- PRESUPUESTOS
-- ============================================================
CREATE TABLE presupuestos (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_presupuesto      integer     NOT NULL UNIQUE DEFAULT nextval('seq_numero_presupuesto'),
    ot_id                   uuid        REFERENCES ordenes_trabajo(id),
    cliente_id              uuid        NOT NULL REFERENCES clientes(id),
    vehiculo_id             uuid        NOT NULL REFERENCES vehiculos(id),
    fecha_emision           date        NOT NULL,
    fecha_vencimiento       date        NOT NULL,  -- DEFAULT = fecha_emision + 72hs
    estado                  varchar(20) DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','enviado','aprobado','rechazado','vencido','convertido')),
    subtotal_mano_obra      decimal(12,2) DEFAULT 0,
    subtotal_repuestos      decimal(12,2) DEFAULT 0,
    descuento               decimal(12,2) DEFAULT 0,
    subtotal_sin_iva        decimal(12,2) DEFAULT 0,
    iva_monto               decimal(12,2) DEFAULT 0,
    total                   decimal(12,2) DEFAULT 0,
    observaciones           text,
    nombre_archivo          varchar(200),  -- PRES_MARCA_PATENTE_DESC_YYYYMMDD.pdf
    created_by_id           uuid        REFERENCES auth.users(id),
    created_at              timestamptz DEFAULT now()
);

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pres_select" ON presupuestos FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista','contador')));
CREATE POLICY "pres_modify" ON presupuestos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_pres_numero ON presupuestos(numero_presupuesto);
CREATE INDEX ix_pres_cliente ON presupuestos(cliente_id);
CREATE INDEX ix_pres_ot ON presupuestos(ot_id) WHERE ot_id IS NOT NULL;
CREATE INDEX ix_pres_estado ON presupuestos(estado);
CREATE INDEX ix_pres_vencimiento ON presupuestos(fecha_vencimiento)
    WHERE estado IN ('borrador','enviado');


-- ============================================================
-- PRESUPUESTO_ITEMS
-- ============================================================
CREATE TABLE presupuesto_items (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id  uuid        NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    tipo            varchar(20) NOT NULL CHECK (tipo IN ('mano_obra','repuesto','otro')),
    articulo_id     uuid        REFERENCES articulos(id),
    descripcion     varchar(300) NOT NULL,
    cantidad        decimal(10,2) NOT NULL,
    precio_unitario decimal(12,2) NOT NULL,
    iva_porcentaje  decimal(5,2) DEFAULT 21.00
                    CHECK (iva_porcentaje IN (0, 10.5, 21.0, 27.0)),
    subtotal        decimal(12,2) NOT NULL  -- cantidad × precio_unitario (sin IVA)
);

ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pres_items_select" ON presupuesto_items FOR SELECT USING (true);
CREATE POLICY "pres_items_modify" ON presupuesto_items FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_pres_items_pres ON presupuesto_items(presupuesto_id);


-- ============================================================
-- COMPROBANTES (facturas emitidas: A, B, C, NC, ND)
-- Numeración correlativa separada por tipo+punto_venta (sequences)
-- ============================================================
CREATE TABLE comprobantes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                  integer     NOT NULL,
    punto_venta             integer     DEFAULT 1,
    tipo_comprobante        varchar(10) NOT NULL
                            CHECK (tipo_comprobante IN ('A','B','C','NC_A','NC_B','ND_A','ND_B')),
    cliente_id              uuid        NOT NULL REFERENCES clientes(id),
    presupuesto_id          uuid        REFERENCES presupuestos(id),
    ot_id                   uuid        REFERENCES ordenes_trabajo(id),
    fecha_emision           date        NOT NULL,
    fecha_vencimiento_pago  date,
    condicion_pago          varchar(50) DEFAULT 'contado'
                            CHECK (condicion_pago IN ('contado','cuenta_corriente','30_dias','60_dias','90_dias')),
    subtotal_gravado        decimal(12,2) DEFAULT 0,
    subtotal_no_gravado     decimal(12,2) DEFAULT 0,
    iva_21                  decimal(12,2) DEFAULT 0,   -- monto IVA 21%
    iva_105                 decimal(12,2) DEFAULT 0,   -- monto IVA 10.5%
    total                   decimal(12,2) NOT NULL,
    estado_cobro            varchar(20) DEFAULT 'pendiente'
                            CHECK (estado_cobro IN ('pendiente','cobrado_parcial','cobrado','vencido')),
    monto_cobrado           decimal(12,2) DEFAULT 0,
    cae                     varchar(20),      -- asignado por AFIP
    cae_vencimiento         date,
    nombre_archivo          varchar(200),     -- FAC-EMIT_MARCA_PATENTE_DESC_YYYYMMDD.pdf
    created_by_id           uuid        REFERENCES auth.users(id),
    created_at              timestamptz DEFAULT now(),

    -- Número único por tipo y punto de venta
    UNIQUE (tipo_comprobante, punto_venta, numero)
);

ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_select" ON comprobantes FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista','contador')));
CREATE POLICY "comp_insert" ON comprobantes FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));
CREATE POLICY "comp_update" ON comprobantes FOR UPDATE
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_comp_numero ON comprobantes(tipo_comprobante, punto_venta, numero);
CREATE INDEX ix_comp_cliente ON comprobantes(cliente_id);
CREATE INDEX ix_comp_ot ON comprobantes(ot_id) WHERE ot_id IS NOT NULL;
CREATE INDEX ix_comp_estado ON comprobantes(estado_cobro);
CREATE INDEX ix_comp_fecha ON comprobantes(fecha_emision);
CREATE INDEX ix_comp_cae ON comprobantes(cae) WHERE cae IS NOT NULL;

-- Función helper para obtener siguiente número de comprobante
CREATE OR REPLACE FUNCTION fn_next_comprobante_number(tipo text)
RETURNS integer AS $$
BEGIN
    CASE tipo
        WHEN 'A' THEN RETURN nextval('seq_numero_comprobante_a');
        WHEN 'B' THEN RETURN nextval('seq_numero_comprobante_b');
        ELSE RETURN nextval('seq_numero_comprobante_c');
    END CASE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- COMPROBANTE_ITEMS
-- ============================================================
CREATE TABLE comprobante_items (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id  uuid        NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
    descripcion     varchar(300) NOT NULL,
    cantidad        decimal(10,2) NOT NULL,
    precio_unitario decimal(12,2) NOT NULL,
    iva_porcentaje  decimal(5,2) DEFAULT 21.00
                    CHECK (iva_porcentaje IN (0, 10.5, 21.0, 27.0)),
    subtotal        decimal(12,2) NOT NULL  -- cantidad × precio_unitario (sin IVA)
);

ALTER TABLE comprobante_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_items_select" ON comprobante_items FOR SELECT USING (true);
CREATE POLICY "comp_items_modify" ON comprobante_items FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_comp_items_comp ON comprobante_items(comprobante_id);


-- ============================================================
-- ORDENES_COMPRA
-- ============================================================
CREATE TABLE ordenes_compra (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_oc               integer     NOT NULL UNIQUE DEFAULT nextval('seq_numero_oc'),
    proveedor_id            uuid        NOT NULL REFERENCES proveedores(id),
    fecha                   date        NOT NULL,
    fecha_entrega_estimada  date,
    estado                  varchar(30) DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','enviada','recibida_parcial','recibida','cancelada')),
    total                   decimal(12,2) DEFAULT 0,
    notas                   text,
    created_by_id           uuid        REFERENCES auth.users(id),
    created_at              timestamptz DEFAULT now()
);

ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_select" ON ordenes_compra FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista','contador')));
CREATE POLICY "oc_modify" ON ordenes_compra FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_oc_numero ON ordenes_compra(numero_oc);
CREATE INDEX ix_oc_proveedor ON ordenes_compra(proveedor_id);
CREATE INDEX ix_oc_estado ON ordenes_compra(estado);

-- Agregar FK de movimientos_stock a ordenes_compra ahora que existe la tabla
ALTER TABLE movimientos_stock ADD CONSTRAINT fk_stock_oc
    FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id);


-- ============================================================
-- OC_ITEMS
-- ============================================================
CREATE TABLE oc_items (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_compra_id     uuid        NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    articulo_id         uuid        NOT NULL REFERENCES articulos(id),
    cantidad_pedida     decimal(10,2) NOT NULL,
    cantidad_recibida   decimal(10,2) DEFAULT 0,
    precio_unitario     decimal(12,2) NOT NULL,
    subtotal            decimal(12,2) NOT NULL  -- cantidad_pedida × precio_unitario
);

ALTER TABLE oc_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_items_select" ON oc_items FOR SELECT USING (true);
CREATE POLICY "oc_items_modify" ON oc_items FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_oc_items_oc ON oc_items(orden_compra_id);
CREATE INDEX ix_oc_items_articulo ON oc_items(articulo_id);


-- ============================================================
-- FACTURAS_RECIBIDAS
-- ============================================================
CREATE TABLE facturas_recibidas (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id        uuid        NOT NULL REFERENCES proveedores(id),
    numero_comprobante  varchar(30),
    tipo_comprobante    varchar(10) CHECK (tipo_comprobante IN ('A','B','C') OR tipo_comprobante IS NULL),
    fecha_emision       date        NOT NULL,
    fecha_vencimiento   date,
    subtotal            decimal(12,2) DEFAULT 0,
    iva                 decimal(12,2) DEFAULT 0,
    total               decimal(12,2) NOT NULL,
    estado_pago         varchar(20) DEFAULT 'pendiente'
                        CHECK (estado_pago IN ('pendiente','pagado_parcial','pagado','vencido')),
    monto_pagado        decimal(12,2) DEFAULT 0,
    orden_compra_id     uuid        REFERENCES ordenes_compra(id),
    nombre_archivo      varchar(200),  -- FAC-REC_PROVEEDOR_NUMERO_YYYYMMDD.pdf
    descripcion         text,
    created_by_id       uuid        REFERENCES auth.users(id),
    created_at          timestamptz DEFAULT now()
);

ALTER TABLE facturas_recibidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fac_rec_select" ON facturas_recibidas FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista','contador')));
CREATE POLICY "fac_rec_modify" ON facturas_recibidas FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista','contador')));

CREATE INDEX ix_fac_rec_proveedor ON facturas_recibidas(proveedor_id);
CREATE INDEX ix_fac_rec_estado ON facturas_recibidas(estado_pago);
CREATE INDEX ix_fac_rec_oc ON facturas_recibidas(orden_compra_id) WHERE orden_compra_id IS NOT NULL;


-- ============================================================
-- COBROS (pagos recibidos de clientes por comprobantes emitidos)
-- ============================================================
CREATE TABLE cobros (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id  uuid        NOT NULL REFERENCES comprobantes(id),
    fecha           date        NOT NULL,
    monto           decimal(12,2) NOT NULL,
    medio_pago      varchar(30) NOT NULL
                    CHECK (medio_pago IN (
                        'efectivo','transferencia','tarjeta_debito',
                        'tarjeta_credito','cheque','cuenta_corriente'
                    )),
    referencia      varchar(100),  -- nro transferencia, cheque, etc.
    notas           text,
    created_by_id   uuid        REFERENCES auth.users(id),
    created_at      timestamptz DEFAULT now()
);

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobros_select" ON cobros FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','contador')));
CREATE POLICY "cobros_modify" ON cobros FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_cobros_comprobante ON cobros(comprobante_id);
CREATE INDEX ix_cobros_fecha ON cobros(fecha);


-- ============================================================
-- PAGOS (pagos realizados a proveedores por facturas recibidas)
-- ============================================================
CREATE TABLE pagos (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_recibida_id uuid        NOT NULL REFERENCES facturas_recibidas(id),
    fecha               date        NOT NULL,
    monto               decimal(12,2) NOT NULL,
    medio_pago          varchar(30) NOT NULL
                        CHECK (medio_pago IN (
                            'efectivo','transferencia','tarjeta_debito',
                            'tarjeta_credito','cheque','cuenta_corriente'
                        )),
    referencia          varchar(100),
    notas               text,
    created_by_id       uuid        REFERENCES auth.users(id),
    created_at          timestamptz DEFAULT now()
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagos_select" ON pagos FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','contador')));
CREATE POLICY "pagos_modify" ON pagos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista','contador')));

CREATE INDEX ix_pagos_factura ON pagos(factura_recibida_id);
CREATE INDEX ix_pagos_fecha ON pagos(fecha);


-- ============================================================
-- CAJA_MOVIMIENTOS (caja diaria)
-- ============================================================
CREATE TABLE caja_movimientos (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha           date        NOT NULL,
    tipo            varchar(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
    concepto        varchar(200) NOT NULL,
    monto           decimal(12,2) NOT NULL,
    cobro_id        uuid        REFERENCES cobros(id),
    pago_id         uuid        REFERENCES pagos(id),
    usuario_id      uuid        REFERENCES auth.users(id),
    created_at      timestamptz DEFAULT now(),

    -- Un movimiento no puede ser cobro y pago al mismo tiempo
    CONSTRAINT chk_caja_unica_ref CHECK (
        cobro_id IS NULL OR pago_id IS NULL
    )
);

ALTER TABLE caja_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caja_select" ON caja_movimientos FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','contador')));
CREATE POLICY "caja_modify" ON caja_movimientos FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_caja_fecha ON caja_movimientos(fecha);
CREATE INDEX ix_caja_cobro ON caja_movimientos(cobro_id) WHERE cobro_id IS NOT NULL;
CREATE INDEX ix_caja_pago ON caja_movimientos(pago_id) WHERE pago_id IS NOT NULL;


-- ============================================================
-- COMUNICACIONES (WhatsApp, email — stub M12)
-- ============================================================
CREATE TABLE comunicaciones (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id      uuid        NOT NULL REFERENCES clientes(id),
    tipo            varchar(20) NOT NULL CHECK (tipo IN ('whatsapp','email','sms')),
    template        varchar(50)
                    CHECK (template IN (
                        'turno_confirmado','vehiculo_listo',
                        'recordatorio_service','presupuesto_enviado',
                        'factura_emitida'
                    ) OR template IS NULL),
    mensaje         text        NOT NULL,
    estado          varchar(20) DEFAULT 'pendiente'
                    CHECK (estado IN ('enviado','fallido','pendiente')),
    referencia_id   uuid,           -- ID del objeto relacionado (OT, presupuesto, etc.)
    referencia_tipo varchar(30)
                    CHECK (referencia_tipo IN ('ot','presupuesto','factura','turno') OR referencia_tipo IS NULL),
    fecha           timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comms_select" ON comunicaciones FOR SELECT
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
                   AND u.rol IN ('admin','recepcionista')));
CREATE POLICY "comms_modify" ON comunicaciones FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('admin','recepcionista')));

CREATE INDEX ix_comms_cliente ON comunicaciones(cliente_id);
CREATE INDEX ix_comms_estado ON comunicaciones(estado);
CREATE INDEX ix_comms_fecha ON comunicaciones(fecha);


-- ============================================================
-- FUNCIONES DE NEGOCIO
-- ============================================================

-- Descuento automático de stock al CERRAR una OT (estado → 'listo' o 'entregado')
-- Se llama desde trigger en ordenes_trabajo
CREATE OR REPLACE FUNCTION fn_descontar_stock_ot()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    stock_ant decimal(10,2);
    nuevo_stock decimal(10,2);
    costo_total decimal(14,2);
    total_units decimal(10,2);
BEGIN
    -- Solo ejecutar cuando estado cambia a 'listo' desde otro estado
    IF NEW.estado = 'listo' AND OLD.estado != 'listo' THEN
        FOR item IN
            SELECT r.*, a.stock_actual, a.precio_costo_promedio
            FROM ot_items_repuestos r
            JOIN articulos a ON a.id = r.articulo_id
            WHERE r.ot_id = NEW.id
            AND r.articulo_id IS NOT NULL
        LOOP
            stock_ant := item.stock_actual;
            nuevo_stock := stock_ant - item.cantidad;

            -- Registrar movimiento de stock
            INSERT INTO movimientos_stock (
                articulo_id, tipo, cantidad,
                stock_anterior, stock_resultante,
                precio_unitario, motivo, ot_id,
                usuario_id, fecha
            ) VALUES (
                item.articulo_id, 'egreso', item.cantidad,
                stock_ant, nuevo_stock,
                item.precio_unitario, 'uso_ot', NEW.id,
                NEW.created_by_id, CURRENT_DATE
            );

            -- Actualizar stock en artículo (permite stock negativo — emite warning)
            UPDATE articulos
            SET stock_actual = nuevo_stock,
                updated_at = now()
            WHERE id = item.articulo_id;

        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ot_descontar_stock
    AFTER UPDATE ON ordenes_trabajo
    FOR EACH ROW EXECUTE FUNCTION fn_descontar_stock_ot();


-- Actualizar precio promedio ponderado al ingresar stock
CREATE OR REPLACE FUNCTION fn_actualizar_ppp()
RETURNS TRIGGER AS $$
DECLARE
    art RECORD;
    nuevo_costo decimal(12,2);
BEGIN
    IF NEW.tipo = 'ingreso' AND NEW.precio_unitario IS NOT NULL THEN
        SELECT stock_actual, precio_costo_promedio INTO art
        FROM articulos WHERE id = NEW.articulo_id;

        IF (art.stock_actual + NEW.cantidad) > 0 THEN
            nuevo_costo := (
                (art.stock_actual * art.precio_costo_promedio) +
                (NEW.cantidad * NEW.precio_unitario)
            ) / (art.stock_actual + NEW.cantidad);

            UPDATE articulos
            SET precio_costo_promedio = nuevo_costo,
                stock_actual = art.stock_actual + NEW.cantidad,
                updated_at = now()
            WHERE id = NEW.articulo_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_ppp
    AFTER INSERT ON movimientos_stock
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_ppp();


-- Función para generar nombre de archivo PDF (convención exacta del taller)
-- PRES_SANDERO_AG244II_EMBRAGUE_20260407.pdf
-- OT_BERLINGO_AG090ID_DISTRIB_20260407.pdf
-- FAC-EMIT_TOYOTA_AF345UK_SERV_20260407.pdf
-- FAC-REC_AUTOCORP_15696_20260407.pdf
CREATE OR REPLACE FUNCTION fn_nombre_pdf(
    tipo_doc text,      -- 'OT','PRES','FAC-EMIT','FAC-REC','NC'
    marca text,
    patente_o_proveedor text,
    descripcion text,   -- máx 15 chars, sin acentos
    fecha date
) RETURNS text AS $$
DECLARE
    desc_clean text;
    fecha_str text;
BEGIN
    -- Limpiar descripción: MAYÚSCULAS, máx 15 chars, sin espacios ni caracteres especiales
    desc_clean := upper(regexp_replace(descripcion, '[^A-Z0-9]', '', 'g'));
    desc_clean := substring(desc_clean from 1 for 15);
    fecha_str := to_char(fecha, 'YYYYMMDD');

    RETURN tipo_doc || '_' || upper(marca) || '_' ||
           upper(patente_o_proveedor) || '_' ||
           desc_clean || '_' || fecha_str || '.pdf';
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- OTs abiertas con días de antigüedad
CREATE VIEW v_ots_abiertas AS
SELECT
    ot.id,
    ot.numero_ot,
    ot.estado,
    v.patente,
    v.marca || ' ' || v.modelo AS vehiculo,
    c.nombre AS cliente,
    t.nombre || ' ' || t.apellido AS tecnico,
    ot.fecha_ingreso,
    CURRENT_DATE - ot.fecha_ingreso AS dias_en_taller,
    ot.total
FROM ordenes_trabajo ot
JOIN vehiculos v ON v.id = ot.vehiculo_id
JOIN clientes c ON c.id = ot.cliente_id
LEFT JOIN tecnicos t ON t.id = ot.tecnico_id
WHERE ot.estado NOT IN ('entregado','cancelado')
ORDER BY ot.fecha_ingreso;

-- Stock bajo mínimo
CREATE VIEW v_stock_critico AS
SELECT
    a.codigo,
    a.nombre,
    a.stock_actual,
    a.stock_minimo,
    a.stock_minimo - a.stock_actual AS faltante,
    p.nombre AS proveedor
FROM articulos a
LEFT JOIN proveedores p ON p.id = a.proveedor_principal_id
WHERE a.activo = true AND a.stock_actual < a.stock_minimo
ORDER BY faltante DESC;

-- Cobros pendientes por cliente
CREATE VIEW v_cobros_pendientes AS
SELECT
    c.nombre AS cliente,
    comp.tipo_comprobante || '-' || lpad(comp.numero::text, 8, '0') AS comprobante,
    comp.fecha_emision,
    comp.total,
    comp.monto_cobrado,
    comp.total - comp.monto_cobrado AS saldo_pendiente
FROM comprobantes comp
JOIN clientes c ON c.id = comp.cliente_id
WHERE comp.estado_cobro IN ('pendiente','cobrado_parcial')
ORDER BY comp.fecha_emision;

-- Facturación del mes actual
CREATE VIEW v_facturacion_mes AS
SELECT
    tipo_comprobante,
    COUNT(*) AS cantidad,
    SUM(total) AS total_sin_nc,
    SUM(CASE WHEN tipo_comprobante IN ('NC_A','NC_B') THEN -total ELSE total END) AS total_neto
FROM comprobantes
WHERE date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE)
GROUP BY tipo_comprobante
ORDER BY tipo_comprobante;


-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Categorías de artículos predefinidas para taller mecánico
INSERT INTO categorias_articulos (nombre, descripcion) VALUES
    ('Filtros',         'Filtros de aceite, aire, combustible, habitáculo'),
    ('Aceites y Fluidos', 'Aceites de motor, caja, diferencial, líquido frenos, refrigerante'),
    ('Frenos',          'Pastillas, discos, tambores, cilindros'),
    ('Suspensión',      'Amortiguadores, resortes, bujes, rotulas'),
    ('Motor',           'Juntas, correas, cadenas, tensores, distribución'),
    ('Eléctrico',       'Baterías, alternadores, arranques, sensores'),
    ('Transmisión',     'Embragues, cajas, cardanes, semiárboles'),
    ('Dirección',       'Cremalleras, terminales, bieletas'),
    ('Escape',          'Caños, catalizadores, silenciadores'),
    ('Carrocería',      'Luces, espejos, molduras'),
    ('Neumáticos',      'Cubiertas, llanta, válvulas'),
    ('Insumos Taller',  'Trapos, solventes, consumibles'),
    ('Otros',           'Artículos varios');
