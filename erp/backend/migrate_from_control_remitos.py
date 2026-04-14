"""
Migración completa de datos desde CONTROL REMITOS (SQL Server proxy en :9972)
al nuevo ERP (PostgreSQL).

Importa:
- 179 proveedores
- 46 notas de pedido → Pedidos
- 328 facturas/remitos → Ingresos
"""

import json
import urllib.request
from datetime import datetime, date
from decimal import Decimal

# ── Setup SQLAlchemy ────────────────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models import Provider, Local, Company, User
from app.models.pedido import Pedido, PedidoStatus
from app.models.ingreso import Ingreso, IngresoStatus, IngresoType

CR_API = "http://localhost:9972"
COMPANY_ID = 3   # Mundo Outdoor
ADMIN_USER_ID = 1

db = SessionLocal()

# ── Helpers ─────────────────────────────────────────────────────────────────

def fix_encoding(s):
    """Fix double-encoded UTF-8 from SQL Server"""
    if not s:
        return s
    try:
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s


def parse_date(s):
    """Parse date strings like '6/3/2026' or '19/2/2026' → date"""
    if not s:
        return date.today()
    s = s.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return date.today()


def fetch_json(endpoint):
    """Fetch JSON from CONTROL REMITOS API"""
    r = urllib.request.urlopen(f"{CR_API}{endpoint}")
    return json.loads(r.read().decode('utf-8'))


# ── 1. Import Providers ────────────────────────────────────────────────────

def migrate_providers():
    print("\n══════ MIGRANDO PROVEEDORES ══════")
    
    cr_provs = fetch_json("/proveedores/")
    print(f"  Proveedores en CONTROL REMITOS: {len(cr_provs)}")
    
    # Delete existing providers (they were placeholder data)
    existing = db.query(Provider).filter(Provider.company_id == COMPANY_ID).all()
    print(f"  Proveedores existentes en ERP: {len(existing)} → eliminando...")
    for p in existing:
        db.delete(p)
    db.flush()
    
    # Build mapping from CR PROVEEDOR_ID → new ERP provider.id
    id_map = {}
    created = 0
    skipped = 0
    
    for cr in cr_provs:
        cr_id = cr.get("PROVEEDOR_ID")
        is_anulado = cr.get("PROVEEDOR_ANULADO", False)
        
        name = fix_encoding(cr.get("PROVEEDOR_NOMBRE") or "Sin nombre")
        cuit = cr.get("CUIT") or None
        contact_name = fix_encoding(cr.get("CONTACTO") or None)
        phone = cr.get("TELEFONO") or None
        email = cr.get("EMAIL") or None
        address = fix_encoding(cr.get("DOMICILIO") or None)
        razon_social = fix_encoding(cr.get("RAZON_SOCIAL") or None)
        
        # Build notes with extra data
        notes_parts = []
        if razon_social and razon_social != name:
            notes_parts.append(f"Razón social: {razon_social}")
        if cr.get("LOCALIDAD"):
            notes_parts.append(f"Localidad: {fix_encoding(cr['LOCALIDAD'])}")
        if cr.get("PROVINCIA"):
            notes_parts.append(f"Provincia: {fix_encoding(cr['PROVINCIA'])}")
        if cr.get("CONDICION"):
            notes_parts.append(f"Condición: {cr['CONDICION']}")
        if cr.get("CODIGO"):
            notes_parts.append(f"Código Tango: {cr['CODIGO']}")
        
        prov = Provider(
            name=name.strip(),
            cuit=cuit.strip() if cuit else None,
            contact_name=contact_name.strip() if contact_name else None,
            phone=phone.strip() if phone else None,
            email=email.strip() if email else None,
            address=address.strip() if address else None,
            notes="\n".join(notes_parts) if notes_parts else None,
            is_active=not is_anulado,
            company_id=COMPANY_ID,
        )
        db.add(prov)
        db.flush()  # Get the ID
        
        if cr_id is not None:
            id_map[cr_id] = prov.id
        created += 1
    
    db.flush()
    print(f"  ✓ Creados: {created} proveedores")
    print(f"  Mapping IDs: {len(id_map)} entries")
    return id_map


# ── 2. Build Local name → id mapping ──────────────────────────────────────

def build_local_map():
    """Map CONTROL REMITOS local names to ERP Local IDs"""
    locals_erp = db.query(Local).filter(Local.company_id == COMPANY_ID).all()
    
    # Exact and fuzzy matching
    name_to_id = {}
    for l in locals_erp:
        name_to_id[l.name.lower()] = l.id
    
    # Manual mapping for known mismatches
    aliases = {
        "mundo outdoor palermo": "mundo palermo",
        "montagne mar del plata güemes": "montagne mar del plata güemes",
        "montagne mar del plata juan b. justo": "montagne mar del plata juan b. justo",
        "montagne neuquén centro": "montagne neuquén centro",
        "montagne villa maría": "montagne villa maría",
        "mundo outdoor bahía blanca san martín": "mundo outdoor bahía blanca san martín",
        "mundo outdoor general roca": "mundo outdoor general roca",
        "montagne general roca": "montagne general roca",
        "neuquén shopping alto comahue": "neuquén shopping alto comahue",
        "neuquén shopping paseo de la patagonia": "neuquén shopping paseo de la patagonia",
        "mundo outdoor bahía blanca plaza shopping": "mundo outdoor bahía blanca plaza shopping",
        "montagne bb local": "montagne bb local",
    }
    
    def find_local_id(cr_name):
        if not cr_name:
            return None
        fixed = fix_encoding(cr_name).lower().strip()
        # Direct match
        if fixed in name_to_id:
            return name_to_id[fixed]
        # Alias match
        if fixed in aliases and aliases[fixed] in name_to_id:
            return name_to_id[aliases[fixed]]
        # Partial match
        for erp_name, erp_id in name_to_id.items():
            if fixed in erp_name or erp_name in fixed:
                return erp_id
        return None
    
    return find_local_id


# ── 3. Import Pedidos (Notas de Pedido) ────────────────────────────────────

def migrate_pedidos(provider_map, find_local_id):
    print("\n══════ MIGRANDO PEDIDOS ══════")
    
    cr_notas = fetch_json("/notas/")
    print(f"  Notas en CONTROL REMITOS: {len(cr_notas)}")
    
    created = 0
    skipped = 0
    
    for nota in cr_notas:
        cr_prov_id = nota.get("PROVEEDOR_ID")
        prov_id = provider_map.get(cr_prov_id)
        
        if not prov_id:
            prov_name = fix_encoding(nota.get("PROVEEDOR_NOMBRE", "N/A"))
            print(f"  ⚠ Provider not mapped: CR_ID={cr_prov_id} ({prov_name})")
            # Try to find by name
            prov = db.query(Provider).filter(
                Provider.company_id == COMPANY_ID,
                Provider.name.ilike(f"%{prov_name.split('-')[0].strip()}%")
            ).first()
            if prov:
                prov_id = prov.id
                print(f"    → Matched by name to ID {prov_id}")
            else:
                skipped += 1
                continue
        
        # Determine status
        is_anulado = nota.get("PEDIDO_ANULADO", False)
        is_finalizado = nota.get("FINALIZADO_FORZADO", False)
        is_diferencia = nota.get("COMPLETADO_CON_DIFERENCIA", False)
        qty_pedido = nota.get("PEDIDO_CANTIDAD", 0) or 0
        qty_facturado = nota.get("CANTIDAD_FACTURADO", 0) or 0
        
        if is_anulado:
            status = PedidoStatus.ANULADO
        elif is_finalizado or is_diferencia:
            status = PedidoStatus.RECIBIDO
        elif qty_facturado > 0 and qty_facturado < qty_pedido:
            status = PedidoStatus.RECIBIDO_PARCIAL
        elif qty_facturado >= qty_pedido and qty_pedido > 0:
            status = PedidoStatus.RECIBIDO
        else:
            status = PedidoStatus.ENVIADO
        
        # Build notes
        local_name = fix_encoding(nota.get("LOCAL") or "")
        notes_parts = []
        if local_name:
            notes_parts.append(f"Local: {local_name}")
        tipo = "PRECOMPRA" if nota.get("PRECOMPRA") else ("REPOSICIÓN" if nota.get("REPOSICION") else "")
        if tipo:
            notes_parts.append(f"Tipo: {tipo}")
        if nota.get("OBSERVACIONES"):
            notes_parts.append(fix_encoding(nota["OBSERVACIONES"]))
        if nota.get("OBS_PARA_COMPRAS"):
            notes_parts.append(f"Obs compras: {fix_encoding(nota['OBS_PARA_COMPRAS'])}")
        if nota.get("NUMEROS_ALTERNATIVOS"):
            notes_parts.append(f"Nros alternativos: {nota['NUMEROS_ALTERNATIVOS']}")
        notes_parts.append(f"Cantidad pedida: {qty_pedido}")
        notes_parts.append(f"Cantidad facturada: {qty_facturado}")
        if is_diferencia:
            notes_parts.append("⚠ COMPLETADO CON DIFERENCIA")
        
        pedido = Pedido(
            number=nota.get("PEDIDO_NUMERO") or f"NP-{nota.get('ID_NOTA', 0)}",
            date=parse_date(nota.get("PEDIDO_FECHA")),
            expected_date=None,
            status=status,
            notes="\n".join(notes_parts),
            total=Decimal(str(qty_pedido)) if qty_pedido else None,
            provider_id=prov_id,
            company_id=COMPANY_ID,
            created_by_id=ADMIN_USER_ID,
        )
        db.add(pedido)
        created += 1
    
    db.flush()
    print(f"  ✓ Creados: {created} pedidos")
    print(f"  ⚠ Skipped: {skipped}")


# ── 4. Import Ingresos (Facturas/Remitos) ──────────────────────────────────

def migrate_ingresos(provider_map):
    print("\n══════ MIGRANDO INGRESOS (FACTURAS/REMITOS) ══════")
    
    cr_facturas = fetch_json("/facturas/")
    print(f"  Facturas en CONTROL REMITOS: {len(cr_facturas)}")
    
    created = 0
    skipped = 0
    
    for fact in cr_facturas:
        cr_prov_id = fact.get("PROVEEDOR_ID")
        prov_id = provider_map.get(cr_prov_id) if cr_prov_id else None
        
        if not prov_id:
            prov_name = fix_encoding(fact.get("PROVEEDOR_NOMBRE") or "")
            if prov_name:
                prov = db.query(Provider).filter(
                    Provider.company_id == COMPANY_ID,
                    Provider.name.ilike(f"%{prov_name.split('-')[0].strip()[:20]}%")
                ).first()
                if prov:
                    prov_id = prov.id
            if not prov_id:
                # Use first active provider as fallback
                prov = db.query(Provider).filter(
                    Provider.company_id == COMPANY_ID,
                    Provider.is_active == True
                ).first()
                if prov:
                    prov_id = prov.id
                    if prov_name:
                        print(f"  ⚠ Provider fallback for: {prov_name} → {prov.name}")
                else:
                    skipped += 1
                    continue
        
        # Map type
        tipo_doc = fact.get("TIPO_DOCUMENTO", "FACTURA")
        if tipo_doc == "REMITO":
            ingreso_type = IngresoType.REMITO
        else:  # FACTURA or REMITO_FACTURA
            ingreso_type = IngresoType.FACTURA
        
        # Map status
        is_anulado = fact.get("FACTURA_ANULADO", False)
        if is_anulado:
            ingreso_status = IngresoStatus.ANULADO
        else:
            ingreso_status = IngresoStatus.CONFIRMADO
        
        # Build notes
        local_name = fix_encoding(fact.get("LOCAL") or "")
        notes_parts = []
        if local_name:
            notes_parts.append(f"Local: {local_name}")
        if fact.get("NUMERO_NOTA_PEDIDO"):
            notes_parts.append(f"Nota de pedido: {fact['NUMERO_NOTA_PEDIDO']}")
        if fact.get("REMITO_COMPRA_NUMERO"):
            notes_parts.append(f"Remito compra: {fact['REMITO_COMPRA_NUMERO']}")
        if fact.get("REMITO_VENTA_NUMERO"):
            notes_parts.append(f"Remito venta: {fact['REMITO_VENTA_NUMERO']}")
        if fact.get("CANTIDAD_REMITO"):
            notes_parts.append(f"Cantidad remito: {fact['CANTIDAD_REMITO']}")
        if fact.get("OBS_PARA_COMPRAS"):
            notes_parts.append(f"Obs compras: {fix_encoding(fact['OBS_PARA_COMPRAS'])}")
        if fact.get("OBS_PARA_LOCALES"):
            notes_parts.append(f"Obs locales: {fix_encoding(fact['OBS_PARA_LOCALES'])}")
        if fact.get("ESTADO_SEMAFORO"):
            notes_parts.append(f"Semáforo: {fact['ESTADO_SEMAFORO']}")
        if fact.get("PAGADO"):
            notes_parts.append("✓ PAGADO")
            if fact.get("METODO_PAGO"):
                notes_parts.append(f"Método: {fact['METODO_PAGO']}")
            if fact.get("FECHA_PAGO"):
                notes_parts.append(f"Fecha pago: {fact['FECHA_PAGO']}")
        if fact.get("CLIENTE_NOMBRE"):
            notes_parts.append(f"Cliente: {fix_encoding(fact['CLIENTE_NOMBRE'])}")
        if fact.get("CLIENTE_CUIT"):
            notes_parts.append(f"CUIT cliente: {fact['CLIENTE_CUIT']}")
        
        # Count items
        items_json = fact.get("ITEMS_JSON")
        n_items = 0
        total_unidades = 0
        if items_json:
            try:
                items = json.loads(items_json) if isinstance(items_json, str) else items_json
                n_items = len(items)
                total_unidades = sum(i.get("unidades", 0) or 0 for i in items)
                notes_parts.append(f"Items: {n_items}, Unidades: {total_unidades}")
            except (json.JSONDecodeError, TypeError):
                pass
        
        factura_qty = fact.get("FACTURA_CANTIDAD") or total_unidades or 0
        notes_parts.append(f"Cantidad factura: {factura_qty}")
        
        monto = fact.get("MONTO_TOTAL")
        
        ingreso = Ingreso(
            type=ingreso_type,
            number=fact.get("FACTURA_NUMERO") or f"ING-{fact.get('FACTURA_ID', 0)}",
            date=parse_date(fact.get("FACTURA_FECHA")),
            status=ingreso_status,
            notes="\n".join(notes_parts),
            total=Decimal(str(monto)) if monto else None,
            provider_id=prov_id,
            company_id=COMPANY_ID,
            created_by_id=ADMIN_USER_ID,
        )
        db.add(ingreso)
        created += 1
    
    db.flush()
    print(f"  ✓ Creados: {created} ingresos")
    print(f"  ⚠ Skipped: {skipped}")


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  MIGRACIÓN CONTROL REMITOS → ERP MUNDO OUTDOOR")
    print("=" * 60)
    
    # Test connection to CONTROL REMITOS API
    try:
        fetch_json("/locales/")
        print("✓ CONTROL REMITOS API accesible en", CR_API)
    except Exception as e:
        print(f"✗ No se puede conectar a CONTROL REMITOS en {CR_API}: {e}")
        return
    
    try:
        # Step 1: Migrate providers
        provider_map = migrate_providers()
        
        # Step 2: Build local name resolver
        find_local = build_local_map()
        
        # Step 3: Migrate pedidos
        migrate_pedidos(provider_map, find_local)
        
        # Step 4: Migrate ingresos
        migrate_ingresos(provider_map)
        
        # Commit all
        db.commit()
        
        # Final counts
        print("\n══════ RESUMEN FINAL ══════")
        print(f"  Proveedores: {db.query(Provider).filter(Provider.company_id == COMPANY_ID).count()}")
        print(f"  Pedidos: {db.query(Pedido).filter(Pedido.company_id == COMPANY_ID).count()}")
        print(f"  Ingresos: {db.query(Ingreso).filter(Ingreso.company_id == COMPANY_ID).count()}")
        print("\n✓ Migración completada exitosamente")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error en migración: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
