#!/usr/bin/env python3
"""
Seed: pobla la DB de Mundo Outdoor con datos de ejemplo.

Corre desde: erp/backend/
Activar venv:  .\\venv\\Scripts\\activate
Ejecutar:      python seed.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from app.db.session import SessionLocal
from app.models import (
    Company, User, UserRole, Local, Provider,
    Product, ProductVariant,
    Ingreso, IngresoItem, IngresoStatus, IngresoType,
    Pedido, PedidoItem, PedidoStatus,
    Sale, SaleItem, SaleType, SaleStatus,
    StockMovement, MovementType,
)
from app.core.security import hash_password

db = SessionLocal()

# ─────────────────────────────────────────────────────────────────────────────
# CATÁLOGO DE PRODUCTOS — outdoor/indumentaria Argentina
# ─────────────────────────────────────────────────────────────────────────────
CATALOG = [
    dict(code="CAMP-SS-01", name="Campera Softshell Summit", brand="Montagne",
         category="Camperas", base_cost=95_000,
         sizes=["S", "M", "L", "XL"], colors=["Negro", "Azul"]),
    dict(code="CAMP-3C-01", name="Campera 3 Capas Artico", brand="Ansilta",
         category="Camperas", base_cost=140_000,
         sizes=["S", "M", "L", "XL"], colors=["Azul", "Rojo"]),
    dict(code="CHAL-SS-01", name="Chaleco Softshell Andes", brand="Montagne",
         category="Chalecos", base_cost=72_000,
         sizes=["S", "M", "L", "XL"], colors=["Verde", "Negro"]),
    dict(code="BUZO-PL-01", name="Buzo Polar Trekking", brand="TecnoTex",
         category="Buzos", base_cost=58_000,
         sizes=["S", "M", "L", "XL"], colors=["Gris", "Negro", "Rojo"]),
    dict(code="PANT-CG-01", name="Pantalón Cargo Trail", brand="Montagne",
         category="Pantalones", base_cost=65_000,
         sizes=["36", "38", "40", "42"], colors=["Beige", "Negro"]),
    dict(code="REM-DF-01", name="Remera Dry-Fit Athletic", brand="TecnoTex",
         category="Remeras", base_cost=28_000,
         sizes=["XS", "S", "M", "L", "XL"], colors=["Blanco", "Negro", "Naranja"]),
    dict(code="MOCH-45L-01", name="Mochila Expedición 45L", brand="TecnoTex",
         category="Mochilas", base_cost=180_000,
         sizes=["ÚNICA"], colors=["Verde", "Gris", "Negro"]),
    dict(code="CALZ-TRK-01", name="Calzado Trekking Summit", brand="ImportDeport",
         category="Calzado", base_cost=125_000,
         sizes=["38", "39", "40", "41", "42", "43"], colors=["Marrón", "Negro"]),
    dict(code="GUAN-PP-01", name="Guantes Polar Pro", brand="Ansilta",
         category="Accesorios", base_cost=22_000,
         sizes=["S", "M", "L"], colors=["Negro", "Azul"]),
    dict(code="GORR-MR-01", name="Gorro Merino", brand="Ansilta",
         category="Accesorios", base_cost=18_000,
         sizes=["ÚNICA"], colors=["Gris", "Azul", "Rojo", "Negro"]),
    dict(code="MEDI-TRK-01", name="Medias Trekking Pro", brand="TecnoTex",
         category="Accesorios", base_cost=9_500,
         sizes=["37-40", "41-44"], colors=["Negro", "Gris"]),
    dict(code="CUELL-PL-01", name="Cuello Polar Neck", brand="TecnoTex",
         category="Accesorios", base_cost=12_000,
         sizes=["ÚNICA"], colors=["Negro", "Azul", "Rojo"]),
]


def sku_of(prod_code, size, color):
    return f"{prod_code}-{size}-{color}".upper().replace(" ", "_").replace("/", "_")


def main():
    # ── 0. Empresa y admin base ───────────────────────────────────────────────
    company = db.query(Company).filter(Company.cuit == "30-12345678-9").first()
    if not company:
        print("ERROR: Ejecutá el backend al menos una vez para crear la empresa inicial.")
        sys.exit(1)

    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("ERROR: Usuario admin no encontrado.")
        sys.exit(1)

    cid = company.id
    aid = admin.id
    print(f"Empresa : {company.name}  (id={cid})")
    print(f"Admin   : {admin.username}  (id={aid})\n")

    # ── 1. Locales ───────────────────────────────────────────────────────────
    print("[1] Locales...")
    locales_def = [
        dict(name="Sucursal Centro", code="LOCAL_CTR",
             address="Av. Santa Fe 1840, CABA", phone="011-4811-0001", company_id=cid),
        dict(name="Sucursal Palermo", code="LOCAL_PAL",
             address="Av. Córdoba 5200, CABA", phone="011-4822-0002", company_id=cid),
        dict(name="Depósito General", code="DEPOSITO",
             address="Ruta 3 km 12, Lomas de Zamora", phone="011-4245-0003", company_id=cid),
    ]
    locales = {}
    for ld in locales_def:
        loc = db.query(Local).filter(Local.code == ld["code"]).first()
        if not loc:
            loc = Local(**ld)
            db.add(loc)
            db.flush()
            print(f"  + {ld['name']}")
        else:
            print(f"  ~ {ld['name']} (ya existe)")
        locales[ld["code"]] = loc

    # ── 2. Proveedores ───────────────────────────────────────────────────────
    print("\n[2] Proveedores...")
    providers_def = [
        dict(name="Montagne S.A.", cuit="30-71234567-9",
             contact_name="Carlos Pereyra", phone="011-4300-1111",
             email="ventas@montagne.com.ar", address="Av. Industria 500, Quilmes", company_id=cid),
        dict(name="Ansilta Outdoor", cuit="30-65432198-7",
             contact_name="Laura Sánchez", phone="0261-422-3344",
             email="comercial@ansilta.com.ar", address="Godoy Cruz 1200, Mendoza", company_id=cid),
        dict(name="TecnoTex S.R.L.", cuit="30-71111222-5",
             contact_name="Diego Alvarez", phone="011-4556-8877",
             email="dtex@tecnotex.com.ar", address="Av. Belgrano 3400, CABA", company_id=cid),
        dict(name="Patagonia Distribuciones", cuit="30-90123456-8",
             contact_name="Ana Torres", phone="011-4711-9900",
             email="ana@patdist.com.ar", address="Av. San Martín 440, GBA", company_id=cid),
        dict(name="ImportDeport S.A.", cuit="30-55667788-1",
             contact_name="Roberto Gómez", phone="011-4489-0055",
             email="compras@importdeport.com.ar", address="Yerbal 1100, CABA", company_id=cid),
    ]
    providers = {}
    for pd in providers_def:
        prov = db.query(Provider).filter(
            Provider.cuit == pd["cuit"], Provider.company_id == cid
        ).first()
        if not prov:
            prov = Provider(**pd)
            db.add(prov)
            db.flush()
            print(f"  + {pd['name']}")
        else:
            print(f"  ~ {pd['name']} (ya existe)")
        providers[pd["name"]] = prov

    # ── 3. Usuarios extra ────────────────────────────────────────────────────
    print("\n[3] Usuarios...")
    users_def = [
        dict(username="vendedor01", full_name="Carlos Méndez",
             email="carlos@mundooutdoor.com.ar", role=UserRole.VENDEDOR,
             hashed_password=hash_password("Vendedor2026!"), company_id=cid, is_active=True),
        dict(username="compras01", full_name="Laura González",
             email="laura@mundooutdoor.com.ar", role=UserRole.COMPRAS,
             hashed_password=hash_password("Compras2026!"), company_id=cid, is_active=True),
        dict(username="caja01", full_name="Martín Ríos",
             email="martin@mundooutdoor.com.ar", role=UserRole.GESTION_PAGOS,
             hashed_password=hash_password("Caja2026!"), company_id=cid, is_active=True),
    ]
    for ud in users_def:
        u = db.query(User).filter(User.username == ud["username"]).first()
        if not u:
            u = User(**ud)
            db.add(u)
            db.flush()
            print(f"  + {ud['username']}  ({ud['role'].value})")
        else:
            print(f"  ~ {ud['username']} (ya existe)")

    # ── 4. Productos + Variantes ─────────────────────────────────────────────
    print("\n[4] Productos + variantes...")
    variants_map: dict[str, ProductVariant] = {}

    for item in CATALOG:
        prod = db.query(Product).filter(
            Product.code == item["code"], Product.company_id == cid
        ).first()
        if not prod:
            prod = Product(
                code=item["code"], name=item["name"], brand=item["brand"],
                category=item["category"], base_cost=item["base_cost"], company_id=cid,
            )
            db.add(prod)
            db.flush()
            n_vars = 0
            for size in item["sizes"]:
                for color in item["colors"]:
                    sku = sku_of(item["code"], size, color)
                    v = ProductVariant(product_id=prod.id, size=size, color=color,
                                       sku=sku, stock=0)
                    db.add(v)
                    db.flush()
                    variants_map[sku] = v
                    n_vars += 1
            print(f"  + {item['name']}  ({n_vars} variantes)")
        else:
            for v in prod.variants:
                variants_map[v.sku] = v
            print(f"  ~ {item['name']} (ya existe)")

    db.commit()

    # Helper rápido
    def var(prod_code, size, color) -> ProductVariant | None:
        key = sku_of(prod_code, size, color)
        v = variants_map.get(key)
        if not v:
            v = db.query(ProductVariant).filter(ProductVariant.sku == key).first()
            if v:
                variants_map[key] = v
        if not v:
            print(f"    WARN: variante no encontrada  {prod_code} {size}/{color}")
        return v

    # ── 5. Ingresos confirmados ──────────────────────────────────────────────
    print("\n[5] Ingresos...")

    def make_ingreso(number, tipo, fecha, provider_name, items_spec, notes=None):
        """items_spec: lista de (prod_code, size, color, qty, unit_cost)"""
        prov = providers[provider_name]
        existing = db.query(Ingreso).filter(
            Ingreso.number == number,
            Ingreso.provider_id == prov.id,
            Ingreso.company_id == cid,
        ).first()
        if existing:
            print(f"  ~ Ingreso {number} de {provider_name} (ya existe)")
            return existing

        ing = Ingreso(
            type=tipo, number=number, date=fecha,
            status=IngresoStatus.CONFIRMADO, notes=notes,
            provider_id=prov.id, company_id=cid, created_by_id=aid,
        )
        db.add(ing)
        db.flush()

        total = 0.0
        for prod_code, size, color, qty, cost in items_spec:
            v = var(prod_code, size, color)
            if not v:
                continue
            db.add(IngresoItem(ingreso_id=ing.id, variant_id=v.id,
                               quantity=qty, unit_cost=cost))
            v.stock += qty
            total += qty * cost
            db.add(StockMovement(
                type=MovementType.INGRESO, variant_id=v.id, quantity=qty,
                reference=f"Ingreso {number}", company_id=cid, created_by_id=aid,
            ))

        ing.total = total
        db.flush()
        print(f"  + Ingreso {number}  ({provider_name})")
        return ing

    # Enero 10 — Montagne: camperas + chalecos
    make_ingreso("R-MONT-001", IngresoType.REMITO, date(2026, 1, 10), "Montagne S.A.", [
        ("CAMP-SS-01", "S",  "Negro", 10, 95_000),
        ("CAMP-SS-01", "M",  "Negro", 15, 95_000),
        ("CAMP-SS-01", "L",  "Negro", 12, 95_000),
        ("CAMP-SS-01", "XL", "Negro",  8, 95_000),
        ("CHAL-SS-01", "M",  "Verde",  8, 72_000),
        ("CHAL-SS-01", "L",  "Verde", 10, 72_000),
        ("CHAL-SS-01", "XL", "Verde",  6, 72_000),
    ])

    # Enero 15 — TecnoTex: buzos (gris + negro) + remeras
    make_ingreso("R-TTEX-001", IngresoType.REMITO, date(2026, 1, 15), "TecnoTex S.R.L.", [
        ("BUZO-PL-01", "S",  "Gris",  15, 58_000),
        ("BUZO-PL-01", "M",  "Gris",  20, 58_000),
        ("BUZO-PL-01", "L",  "Gris",  18, 58_000),
        ("BUZO-PL-01", "XL", "Gris",  12, 58_000),
        ("BUZO-PL-01", "S",  "Negro", 15, 58_000),
        ("BUZO-PL-01", "M",  "Negro", 20, 58_000),
        ("BUZO-PL-01", "L",  "Negro", 18, 58_000),
        ("BUZO-PL-01", "XL", "Negro", 12, 58_000),
        ("REM-DF-01",  "S",  "Blanco", 20, 28_000),
        ("REM-DF-01",  "M",  "Blanco", 25, 28_000),
        ("REM-DF-01",  "L",  "Blanco", 20, 28_000),
        ("REM-DF-01",  "S",  "Negro",  15, 28_000),
        ("REM-DF-01",  "M",  "Negro",  20, 28_000),
        ("REM-DF-01",  "L",  "Negro",  15, 28_000),
    ])

    # Enero 20 — Ansilta: camperas 3 capas + guantes + gorros
    make_ingreso("F-ANSI-001", IngresoType.FACTURA, date(2026, 1, 20), "Ansilta Outdoor", [
        ("CAMP-3C-01", "M",     "Azul",  6, 140_000),
        ("CAMP-3C-01", "L",     "Azul",  8, 140_000),
        ("CAMP-3C-01", "XL",    "Azul",  5, 140_000),
        ("GUAN-PP-01", "S",     "Negro", 8,  22_000),
        ("GUAN-PP-01", "M",     "Negro", 12, 22_000),
        ("GUAN-PP-01", "L",     "Negro", 10, 22_000),
        ("GORR-MR-01", "ÚNICA", "Gris",  15, 18_000),
        ("GORR-MR-01", "ÚNICA", "Negro", 15, 18_000),
        ("GORR-MR-01", "ÚNICA", "Azul",  10, 18_000),
    ])

    # Febrero 5 — TecnoTex: pantalones + medias + cuellos
    make_ingreso("R-TTEX-002", IngresoType.REMITO, date(2026, 2, 5), "TecnoTex S.R.L.", [
        ("PANT-CG-01",  "38",    "Negro", 10, 65_000),
        ("PANT-CG-01",  "40",    "Negro", 12, 65_000),
        ("PANT-CG-01",  "42",    "Negro",  8, 65_000),
        ("PANT-CG-01",  "38",    "Beige",  8, 65_000),
        ("PANT-CG-01",  "40",    "Beige", 10, 65_000),
        ("MEDI-TRK-01", "37-40", "Negro", 20,  9_500),
        ("MEDI-TRK-01", "41-44", "Negro", 20,  9_500),
        ("MEDI-TRK-01", "37-40", "Gris",  15,  9_500),
        ("CUELL-PL-01", "ÚNICA", "Negro", 10, 12_000),
        ("CUELL-PL-01", "ÚNICA", "Azul",  10, 12_000),
        ("CUELL-PL-01", "ÚNICA", "Rojo",   8, 12_000),
    ])

    # Febrero 18 — ImportDeport: calzado trekking
    make_ingreso("R-IDEP-001", IngresoType.REMITO, date(2026, 2, 18), "ImportDeport S.A.", [
        ("CALZ-TRK-01", "39", "Negro",  8, 125_000),
        ("CALZ-TRK-01", "40", "Negro", 10, 125_000),
        ("CALZ-TRK-01", "41", "Negro", 10, 125_000),
        ("CALZ-TRK-01", "42", "Negro",  8, 125_000),
        ("CALZ-TRK-01", "39", "Marrón", 6, 125_000),
        ("CALZ-TRK-01", "40", "Marrón", 8, 125_000),
        ("CALZ-TRK-01", "41", "Marrón", 8, 125_000),
        ("CALZ-TRK-01", "42", "Marrón", 6, 125_000),
    ])

    # Marzo 3 — Patagonia Dist: mochilas + camperas azul
    make_ingreso("F-PDIS-001", IngresoType.FACTURA, date(2026, 3, 3), "Patagonia Distribuciones", [
        ("MOCH-45L-01", "ÚNICA", "Verde", 5, 180_000),
        ("MOCH-45L-01", "ÚNICA", "Gris",  5, 180_000),
        ("MOCH-45L-01", "ÚNICA", "Negro", 5, 180_000),
        ("CAMP-SS-01",  "M",     "Azul", 10,  95_000),
        ("CAMP-SS-01",  "L",     "Azul", 12,  95_000),
        ("CAMP-SS-01",  "XL",    "Azul",  8,  95_000),
        ("CAMP-3C-01",  "S",     "Rojo",  8, 140_000),
        ("CAMP-3C-01",  "M",     "Rojo", 10, 140_000),
    ])

    db.commit()

    # ── 6. Ventas ────────────────────────────────────────────────────────────
    print("\n[6] Ventas...")
    local_ctr = locales.get("LOCAL_CTR")
    local_pal = locales.get("LOCAL_PAL")

    def make_sale(number, tipo, fecha, status, customer, items_spec, local=None, notes=None):
        """items_spec: lista de (prod_code, size, color, qty, unit_price)"""
        existing = db.query(Sale).filter(
            Sale.number == number, Sale.company_id == cid
        ).first()
        if existing:
            print(f"  ~ Venta {number} (ya existe)")
            return existing

        subtotal = sum(qty * price for _, _, _, qty, price in items_spec)
        tax = round(subtotal * 0.21, 2) if tipo == SaleType.FACTURA_A else 0.0
        total = subtotal + tax

        sale = Sale(
            type=tipo, number=number, date=fecha, status=status,
            customer_name=customer, notes=notes,
            subtotal=subtotal, tax=tax, total=total,
            local_id=local.id if local else None,
            company_id=cid, created_by_id=aid,
        )
        db.add(sale)
        db.flush()

        for prod_code, size, color, qty, price in items_spec:
            v = var(prod_code, size, color)
            if not v:
                continue
            db.add(SaleItem(sale_id=sale.id, variant_id=v.id,
                            quantity=qty, unit_price=price))
            if status in (SaleStatus.EMITIDA, SaleStatus.PAGADA):
                v.stock = max(0, v.stock - qty)
                db.add(StockMovement(
                    type=MovementType.EGRESO, variant_id=v.id, quantity=-qty,
                    reference=f"Venta {number}", company_id=cid, created_by_id=aid,
                ))

        db.flush()
        print(f"  + Venta {number}  ({status.value})  — {customer}")
        return sale

    make_sale("TICK-2026-0001", SaleType.TICKET, date(2026, 1, 12),
              SaleStatus.PAGADA, "Juan García", [
                  ("CAMP-SS-01", "M",     "Negro", 1, 160_000),
                  ("GORR-MR-01", "ÚNICA", "Gris",  1,  30_000),
              ], local=local_ctr)

    make_sale("FB-2026-0001", SaleType.FACTURA_B, date(2026, 1, 18),
              SaleStatus.EMITIDA, "Deportes Andes S.R.L.", [
                  ("BUZO-PL-01", "L", "Gris",   5, 95_000),
                  ("REM-DF-01",  "M", "Blanco", 5, 47_000),
              ], local=local_ctr)

    make_sale("TICK-2026-0002", SaleType.TICKET, date(2026, 1, 25),
              SaleStatus.PAGADA, "María Rodríguez", [
                  ("PANT-CG-01",  "40",    "Negro", 1, 110_000),
                  ("CUELL-PL-01", "ÚNICA", "Azul",  1,  20_000),
              ], local=local_pal)

    make_sale("FA-2026-0001", SaleType.FACTURA_A, date(2026, 2, 3),
              SaleStatus.PAGADA, "Club de Montaña Tigre", [
                  ("CAMP-3C-01",  "M",     "Azul",  3, 235_000),
                  ("PANT-CG-01",  "40",    "Negro", 3, 110_000),
                  ("MEDI-TRK-01", "37-40", "Negro", 6,  16_000),
              ], local=local_ctr)

    make_sale("TICK-2026-0003", SaleType.TICKET, date(2026, 2, 10),
              SaleStatus.PAGADA, "Pedro López", [
                  ("CALZ-TRK-01", "42",    "Negro",  1, 210_000),
                  ("MEDI-TRK-01", "41-44", "Negro",  2,  16_000),
              ], local=local_pal)

    make_sale("FB-2026-0002", SaleType.FACTURA_B, date(2026, 2, 20),
              SaleStatus.EMITIDA, "Outdoors Corp S.A.", [
                  ("BUZO-PL-01", "S", "Gris", 10, 95_000),
                  ("BUZO-PL-01", "M", "Gris", 10, 95_000),
                  ("BUZO-PL-01", "L", "Gris", 10, 95_000),
                  ("REM-DF-01",  "L", "Naranja", 5, 47_000),
              ], local=local_ctr)

    make_sale("TICK-2026-0004", SaleType.TICKET, date(2026, 2, 25),
              SaleStatus.PAGADA, "Sofía Herrera", [
                  ("GORR-MR-01", "ÚNICA", "Negro", 2, 30_000),
                  ("GUAN-PP-01", "M",     "Negro", 2, 37_000),
                  ("CUELL-PL-01","ÚNICA", "Rojo",  1, 20_000),
              ], local=local_pal)

    make_sale("FB-2026-0003", SaleType.FACTURA_B, date(2026, 3, 5),
              SaleStatus.EMITIDA, "Aventura Shop S.R.L.", [
                  ("MOCH-45L-01", "ÚNICA", "Verde",  2, 305_000),
                  ("MOCH-45L-01", "ÚNICA", "Gris",   1, 305_000),
                  ("CALZ-TRK-01", "40",    "Marrón", 2, 210_000),
              ], local=local_ctr)

    make_sale("TICK-2026-0005", SaleType.TICKET, date(2026, 3, 15),
              SaleStatus.PAGADA, "Lucas Fernández", [
                  ("CAMP-SS-01", "L", "Azul",  1, 160_000),
                  ("CHAL-SS-01", "L", "Verde", 1, 122_000),
              ], local=local_pal)

    make_sale("TICK-2026-0006", SaleType.TICKET, date(2026, 3, 20),
              SaleStatus.EMITIDA, "Consumidor Final", [
                  ("BUZO-PL-01", "M",  "Negro",  2, 95_000),
                  ("PANT-CG-01", "42", "Beige",  1, 110_000),
              ], local=local_ctr)

    db.commit()

    # ── 7. Pedidos a proveedor ───────────────────────────────────────────────
    print("\n[7] Pedidos...")

    def make_pedido(number, fecha, exp_date, status, provider_name, items_spec, notes=None):
        """items_spec: lista de (prod_code, size, color, qty, unit_cost)"""
        prov = providers[provider_name]
        existing = db.query(Pedido).filter(
            Pedido.number == number, Pedido.company_id == cid
        ).first()
        if existing:
            print(f"  ~ Pedido {number} (ya existe)")
            return existing

        total = sum(qty * cost for _, _, _, qty, cost in items_spec)
        ped = Pedido(
            number=number, date=fecha, expected_date=exp_date,
            status=status, notes=notes, total=total,
            provider_id=prov.id, company_id=cid, created_by_id=aid,
        )
        db.add(ped)
        db.flush()

        for prod_code, size, color, qty, cost in items_spec:
            v = var(prod_code, size, color)
            if not v:
                continue
            db.add(PedidoItem(pedido_id=ped.id, variant_id=v.id,
                              quantity=qty, unit_cost=cost))

        db.flush()
        print(f"  + Pedido {number}  ({status.value})  — {provider_name}")
        return ped

    make_pedido(
        "PED-2026-0001", date(2026, 1, 5), date(2026, 1, 25),
        PedidoStatus.ENVIADO, "Montagne S.A.", [
            ("CAMP-SS-01", "S",  "Azul",  20, 95_000),
            ("CAMP-SS-01", "M",  "Azul",  20, 95_000),
            ("CAMP-SS-01", "S",  "Negro", 15, 95_000),
            ("CHAL-SS-01", "S",  "Negro", 15, 72_000),
            ("CHAL-SS-01", "M",  "Negro", 15, 72_000),
            ("CHAL-SS-01", "L",  "Negro", 10, 72_000),
        ],
        notes="Pedido temporada invierno. Confirmar palletizado.",
    )

    make_pedido(
        "PED-2026-0002", date(2026, 1, 10), date(2026, 1, 28),
        PedidoStatus.RECIBIDO, "TecnoTex S.R.L.", [
            ("BUZO-PL-01", "S",  "Negro", 20, 58_000),
            ("BUZO-PL-01", "M",  "Negro", 25, 58_000),
            ("BUZO-PL-01", "L",  "Negro", 20, 58_000),
            ("BUZO-PL-01", "XL", "Negro", 15, 58_000),
            ("BUZO-PL-01", "S",  "Rojo",  10, 58_000),
            ("BUZO-PL-01", "M",  "Rojo",  12, 58_000),
        ],
        notes="Recibido íntegramente el 28/01.",
    )

    make_pedido(
        "PED-2026-0003", date(2026, 2, 15), date(2026, 3, 10),
        PedidoStatus.ENVIADO, "ImportDeport S.A.", [
            ("CALZ-TRK-01", "38", "Negro",  10, 125_000),
            ("CALZ-TRK-01", "43", "Negro",  10, 125_000),
            ("CALZ-TRK-01", "38", "Marrón",  8, 125_000),
            ("CALZ-TRK-01", "43", "Marrón",  8, 125_000),
        ],
        notes="Talles extremos — demora habitual 3 semanas.",
    )

    make_pedido(
        "PED-2026-0004", date(2026, 3, 10), date(2026, 4, 5),
        PedidoStatus.BORRADOR, "Patagonia Distribuciones", [
            ("MOCH-45L-01", "ÚNICA", "Verde", 10, 180_000),
            ("MOCH-45L-01", "ÚNICA", "Gris",  10, 180_000),
            ("MOCH-45L-01", "ÚNICA", "Negro", 10, 180_000),
            ("CHAL-SS-01",  "S",     "Verde", 12,  72_000),
            ("CHAL-SS-01",  "XL",    "Verde",  8,  72_000),
        ],
        notes="Borrador — confirmar precio antes de enviar.",
    )

    db.commit()

    # ── Resumen ──────────────────────────────────────────────────────────────
    print("\n" + "─" * 50)
    print("✓  Seed completado!\n")
    n_loc  = db.query(Local).filter(Local.company_id == cid).count()
    n_prov = db.query(Provider).filter(Provider.company_id == cid).count()
    n_user = db.query(User).filter(User.company_id == cid).count()
    n_prod = db.query(Product).filter(Product.company_id == cid).count()
    n_var  = db.query(ProductVariant).join(Product).filter(Product.company_id == cid).count()
    n_ing  = db.query(Ingreso).filter(Ingreso.company_id == cid).count()
    n_sale = db.query(Sale).filter(Sale.company_id == cid).count()
    n_ped  = db.query(Pedido).filter(Pedido.company_id == cid).count()
    n_mov  = db.query(StockMovement).filter(StockMovement.company_id == cid).count()
    print(f"  Locales        : {n_loc}")
    print(f"  Proveedores    : {n_prov}")
    print(f"  Usuarios       : {n_user}")
    print(f"  Productos      : {n_prod}  ({n_var} variantes)")
    print(f"  Ingresos       : {n_ing}")
    print(f"  Ventas         : {n_sale}")
    print(f"  Pedidos        : {n_ped}")
    print(f"  Mov. de stock  : {n_mov}")
    print("─" * 50)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        db.rollback()
        print(f"\nERROR: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()
