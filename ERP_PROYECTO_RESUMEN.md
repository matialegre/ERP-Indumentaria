# ERP Mundo Outdoor - Exploración Completa del Proyecto

## ESTADO ACTUAL DEL PROYECTO
- **Nombre:** Control Remitos / Sistema Pedidos
- **Version:** MVP + V1 features (en desarrollo)
- **Tipo:** Sistema web para gestión de pedidos, remitos, facturas, pagos
- **Tech Stack:** 
  - Backend: Python FastAPI (port 9972)
  - Frontend: React + TypeScript + Vite (port 5173)
  - DB: SQLite (dev.db / pedidos.db)
  - ORM: SQLAlchemy
  - Auth: JWT + bcrypt

## PRODUCCIÓN vs DESARROLLO
- **Backend de prueba:** `backend/app/` con `dev.db` - simple, limpio, MVP
- **Sistema real:** `SISTEMA PEDIDOS/servidor/` con `BASE_DATOS/pedidos.db` - 50+ columnas proveedores, complejo
- **Proxy admin:** `remitos_real.py` y `admin_proxy.py` hacen proxy a servidor real en 192.168.0.128:9972
- **SQL Server:** router `sql_server.py` se conecta a 192.168.0.109:9970 base DATOS (integración legacy Tango)

## ESTADO DE CALIDAD
- **Backend MVP:** Bien estructurado, código limpio, roles/permisos correctos
- **Backend real:** Altamente complejo, 100+ campos, múltiples integraciones, FORZADO a producción sin refactoring
- **Frontend MVP:** React limpio, TypeScript types, React Query
- **Frontend real:** 1000+ lines per tab, múltiples integraciones PDF parsing, IA (OpenRouter), muy complejo

## DEUDA TÉCNICA CRÍTICA
- No hay Alembic migrations organizadas (manual ALTER TABLE en startup)
- `remitos_real.py` y `admin_proxy.py` son workarounds temporales
- Frontend tiene lógica de negocio mezclada en componentes (no separada en hooks/utils)
- SQL Server integration es frágil (hardcoded credentials, no manejo de errores robusto)
- Múltiples fuentes de verdad (dev.db, pedidos.db, SQL Server, PDF parsing)

## PRÓXIMOS PASOS CRÍTICOS
1. Decidir: ¿usar MVP limpio como base o migrar del sistema complejo?
2. Si migrar: refactorizar backend real con Alembic, schemas Pydantic
3. Separar capas frontend: API client, hooks, business logic, UI components
4. Eliminar workarounds proxy, hacer integraciones directas
5. Documentar credenciales SQL Server, config mail
6. Consolidar fuentes de datos
