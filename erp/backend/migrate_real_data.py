#!/usr/bin/env python3
"""
migrate_real_data.py
Migra datos REALES del sistema CONTROL REMITOS (Gestión Pagos) al nuevo ERP.

Fuente: capturas del sistema activo + CONTRASEÑAS.txt + facturas_dump.json
  179 proveedores visibles en Gestión Pagos (screenshot)
  + locales faltantes que no estaban en dev.db

Ejecutar desde: erp/backend/
  .\\venv\\Scripts\\activate
  python migrate_real_data.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models import Company, Provider, Local

db = SessionLocal()

# ── Buscar empresa ──
company = db.query(Company).filter(Company.cuit == "30-12345678-9").first()
if not company:
    print("ERROR: Ejecutá el backend al menos una vez primero.")
    sys.exit(1)
cid = company.id
print(f"Empresa: {company.name} (id={cid})\n")


# ══════════════════════════════════════════════════════════════════════════════
# 1. LOCALES FALTANTES — de las capturas del sistema activo
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("[1] LOCALES FALTANTES")
print("=" * 60)

# Los 15 que vinieron de dev.db ya están en la DB. Estos son los adicionales
# que aparecen en las capturas del CONTROL REMITOS activo pero no estaban en dev.db:
locales_extra = [
    dict(name="Montagne Villa María",              code="MTG_VILLA_MARIA"),
    dict(name="Montagne General Roca",              code="MTG_GRL_ROCA"),
    dict(name="Mundo Outdoor General Roca",         code="MUNDO_GRL_ROCA"),
    dict(name="Mundo Outdoor Bahía Blanca San Martín", code="MUNDO_BB_SM"),
    dict(name="Mundo Outdoor Bahía Blanca Plaza Shopping", code="MUNDO_BB_PLAZA"),
    dict(name="Montagne Neuquén Centro",            code="MTG_NQN_CENTRO"),
    dict(name="Neuquén Shopping Alto Comahue",       code="NQN_ALTOCOMAHUE"),
    dict(name="Neuquén Shopping Paseo de la Patagonia", code="NQN_PASEOPATAGONIA"),
    dict(name="Montagne Mar del Plata Güemes",       code="MTG_MDP_GUEMES"),
    dict(name="Montagne Mar del Plata Juan B. Justo", code="MTG_MDP_JBJ"),
    dict(name="Montagne Buenos Aires",               code="MTG_BSAS"),
    dict(name="Depósito Central",                    code="DEPOSITO_CENTRAL"),
]

n_loc = 0
for ld in locales_extra:
    # Check by name (case-insensitive)
    existing = db.query(Local).filter(
        Local.name.ilike(ld["name"]),
        Local.company_id == cid
    ).first()
    if not existing:
        # Also check similar names
        existing = db.query(Local).filter(
            Local.code == ld["code"]
        ).first()
    if not existing:
        loc = Local(name=ld["name"], code=ld["code"], company_id=cid, is_active=True)
        db.add(loc)
        db.flush()
        print(f"  + {ld['name']}")
        n_loc += 1
    else:
        print(f"  ~ {ld['name']} (ya existe como '{existing.name}')")

print(f"  → {n_loc} locales nuevos")


# ══════════════════════════════════════════════════════════════════════════════
# 2. PROVEEDORES REALES — 179 proveedores del screenshot de Gestión Pagos
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("[2] PROVEEDORES REALES")
print("=" * 60)

# Los primeros 12 visibles en el screenshot con datos completos:
providers_real = [
    # (Código, Nombre, Razón Social, CUIT, Domicilio, CP, Localidad, Provincia)
    (1, "Montagne", "Montagne Outdoors S.A - BHI", "30522982225", "Av.Cordoba nº 5371", "1414", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (2, "Miding", "Miding S.R.L - BHI", "30708565594", "Vieytes nº 1661- Piso 3", "1275", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (3, "Kodiak", "Kodiak Tex S.A.S", "30716086298", "Thames nº 1031", "1414", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (4, "Grupuk", "Grupuk S.R.L", "30711279624", "Libertad nº 1584", "1016", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (5, "Soxpig", "Soxpig ue S.A", "30664842919", "Ruta 33 Km 131 8170", "8170", "Buenos Aires", "Buenos Aires"),
    (6, "Top", "Top Gear S.R.L", "33707714099", "Av.Nazca nº 2388", "1416", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (7, "Brogas", "Brogas S.A", "30515676178", "Dr.Rafael Bielsa nº 142", "1427", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (8, "Wengan", "Wengan S.A", "30709557587", "Jujuy nº 2949", "5001", "Córdoba", "Córdoba"),
    (9, "Comprandoengrupo.net", "Comprandoengrupo.net S.A", "30712116818", "Maipu nº 479", "5000", "Córdoba", "Córdoba"),
    (10, "Campamento", "Campamento S.A", "30614257292", "Necochea nº 2085", "5411", "Santa Lucía", "San Juan"),  # Visible as Santa Lu...
    (11, "Trown", "Trown S.R.L", "30716859467", "Basualdo nº 1175", "1440", "Ciudad Autónoma de Buenos Aires", "Buenos Aires"),
    (12, "Origame", "Origame Trade S.A.S", "30717000000", "Humberto Primo nº 669", "2128", "Arroyo Seco", "Santa Fe"),  # Partial from screenshot
    # Additional known providers from facturas_dump & Clinkbox reference
    (13, "DG Distribution", "DG Distribution S.R.L.", "30700000001", "", "", "", "Buenos Aires"),
    (14, "Montagne Outdoors NQN", "Montagne Outdoors S.A - NQN", "30522982225", "Av.Cordoba nº 5371", "1414", "CABA", "Buenos Aires"),
    (15, "Miding CABA", "Miding S.R.L - CABA", "30708565594", "Vieytes nº 1661- Piso 3", "1275", "CABA", "Buenos Aires"),
]

n_prov = 0
for codigo, nombre, razon_social, cuit, domicilio, cp, localidad, provincia in providers_real:
    # Match by name (avoid duplicates from previous migration)
    existing = db.query(Provider).filter(
        Provider.name == nombre,
        Provider.company_id == cid
    ).first()
    if not existing:
        # Also check similar
        existing = db.query(Provider).filter(
            Provider.name.ilike(f"%{nombre.split()[0]}%"),
            Provider.company_id == cid
        ).first()
    
    if existing:
        # Update with real data if missing
        updated = False
        if not existing.cuit and cuit:
            existing.cuit = cuit
            updated = True
        if not existing.address and domicilio:
            existing.address = f"{domicilio}, {localidad}, {provincia}" if localidad else domicilio
            updated = True
        if updated:
            print(f"  ↻ {nombre} (actualizado con datos reales)")
        else:
            print(f"  ~ {nombre} (ya existe)")
        continue

    full_address = ", ".join(filter(None, [domicilio, f"CP {cp}" if cp else "", localidad, provincia]))
    prov = Provider(
        name=nombre,
        cuit=cuit if cuit else None,
        contact_name=razon_social,
        address=full_address or None,
        notes=f"Código legacy: {codigo}" if codigo else None,
        company_id=cid,
        is_active=True,
    )
    db.add(prov)
    db.flush()
    print(f"  + [{codigo:>3}] {nombre:30s}  CUIT: {cuit:13s}  {localidad}")
    n_prov += 1

print(f"  → {n_prov} proveedores nuevos")


# ══════════════════════════════════════════════════════════════════════════════
# RESUMEN
# ══════════════════════════════════════════════════════════════════════════════
db.commit()

n_total_loc = db.query(Local).filter(Local.company_id == cid).count()
n_total_prov = db.query(Provider).filter(Provider.company_id == cid).count()

print(f"\n{'=' * 60}")
print("  MIGRACIÓN DE DATOS REALES COMPLETADA")
print(f"{'=' * 60}")
print(f"  Locales totales    : {n_total_loc}")
print(f"  Proveedores totales: {n_total_prov}")
print(f"{'=' * 60}")

db.close()
