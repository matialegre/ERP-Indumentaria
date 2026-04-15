"""
CRM Seed Data — Activa el módulo CRM para una company.

Uso:
  cd erp/backend
  python scripts/crm_seed.py --company-id <UUID>
"""

import argparse
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.module import CompanyModule, MODULES_CATALOG

settings = get_settings()
engine = create_engine(settings.DATABASE_URL)


def seed_crm(company_id: str):
    with Session(engine) as db:
        crm_catalog = next((m for m in MODULES_CATALOG if m["slug"] == "CRM"), None)
        if not crm_catalog:
            print("ERROR: CRM no encontrado en MODULES_CATALOG")
            return

        existing = db.query(CompanyModule).filter_by(
            company_id=company_id, slug="CRM"
        ).first()

        if not existing:
            cm = CompanyModule(
                id=str(uuid.uuid4()),
                company_id=company_id,
                slug="CRM",
                name=crm_catalog["name"],
                enabled=True,
            )
            db.add(cm)
            print(f"  ✅ Módulo CRM activado para company {company_id}")
        else:
            existing.enabled = True
            print(f"  ✅ Módulo CRM ya existía, habilitado")

        db.commit()
        print("\n🎉 Seed CRM completado!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed CRM module data")
    parser.add_argument("--company-id", required=True, help="UUID de la company")
    args = parser.parse_args()
    seed_crm(args.company_id)
