# Estructura del Proyecto — ERP Mundo Outdoor (Fase 0)

## Stack decidido
- **Backend**: Node.js + Fastify
- **DB Local (dispositivo)**: SQLite con better-sqlite3
- **DB Central (servidor)**: PostgreSQL
- **Auth**: JWT con empresa_id + rol + dispositivo_id
- **Sync**: Custom event sourcing (estructura preparada, decisión final del arquitecto)

---

## Árbol de archivos — Fase 0

```
ERP MUNDO OUTDOOR/
│
├── estructura.md                ← ESTE ARCHIVO. Mapa del proyecto.
│
├── schema/                      ← Definiciones SQL (DDL)
│   ├── 001_empresas.sql         ← Tablas core: empresas, usuarios, roles, dispositivos
│   ├── 002_sync.sql             ← Event sourcing: eventos_sync + cola_sync
│   └── 003_catalogo.sql         ← Productos, variantes, stock, movimientos
│
├── docs/                        ← Documentación de diseño
│   └── schema-decisions.md      ← Decisiones de diseño y sus razones
│
├── server/                      ← (FUTURO) Backend Fastify - API central
│   ├── src/
│   │   ├── routes/              ← Rutas Fastify por dominio
│   │   ├── services/            ← Lógica de negocio
│   │   ├── db/                  ← Conexión PostgreSQL + migraciones
│   │   ├── sync/                ← Motor de sincronización servidor
│   │   ├── auth/                ← JWT, middleware de auth
│   │   └── index.js             ← Entry point
│   ├── package.json
│   └── .env.example
│
├── client/                      ← (FUTURO) App cliente (PWA o desktop)
│   ├── src/
│   │   ├── db/                  ← SQLite local con better-sqlite3
│   │   ├── sync/                ← Motor de sincronización cliente
│   │   ├── services/            ← Lógica de negocio offline-first
│   │   └── index.js             ← Entry point
│   └── package.json
│
└── shared/                      ← (FUTURO) Código compartido server/client
    ├── constants.js             ← Roles, estados, enums
    ├── validators.js            ← Validaciones de negocio reutilizables
    └── sync-protocol.js         ← Definición del protocolo de sync
```

---

## Descripción de cada componente

### `/schema/` — Schemas SQL
Archivos `.sql` numerados que definen la estructura de tablas. Son **agnósticos de motor**: usan SQL estándar compatible con SQLite Y PostgreSQL salvo donde se indique. Cada archivo incluye comentarios sobre diferencias entre motores.

| Archivo | Contenido | Propósito |
|---------|-----------|-----------|
| `001_empresas.sql` | empresas, usuarios, usuario_empresa, dispositivos | Multi-tenant core + auth |
| `002_sync.sql` | eventos_sync, cola_sync | Event sourcing para sync offline/online |
| `003_catalogo.sql` | productos, variantes_producto, movimientos_stock | Catálogo e inventario |

### `/docs/` — Documentación técnica
| Archivo | Propósito |
|---------|-----------|
| `schema-decisions.md` | Registro de cada decisión de diseño con justificación |

### `/server/` — Backend centralizado (FUTURO)
API REST con Fastify. Conecta a PostgreSQL. Recibe eventos de sync de los clientes, resuelve conflictos, distribuye cambios.

### `/client/` — Cliente offline-first (FUTURO)
App que corre en cada dispositivo (local, vendedor, depósito). Usa SQLite local para operar sin conexión. Sincroniza con el servidor cuando hay red.

### `/shared/` — Código compartido (FUTURO)
Constantes, validadores y protocolo de sync que usan tanto server como client. Evita duplicación y garantiza consistencia.

---

## Convenciones

- **IDs**: UUID v4 en todas las tablas (compatibilidad sync distribuido)
- **Timestamps**: ISO 8601 con timezone, almacenados como TEXT en SQLite y TIMESTAMPTZ en PostgreSQL
- **JSON**: Campos flexibles usan JSON (config, atributos de variante)
- **Naming**: snake_case en tablas y columnas, sin prefijos de tabla
- **Soft delete**: Campo `activo BOOLEAN DEFAULT true` donde aplique
- **Auditoría**: `created_at` y `updated_at` en toda tabla de negocio
