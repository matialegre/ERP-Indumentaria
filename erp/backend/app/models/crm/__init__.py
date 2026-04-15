"""
CRM Avanzado — Todos los modelos del módulo CRM.
Importados aquí para que Alembic los descubra automáticamente.
"""

from app.models.crm.identity import CrmIdentity
from app.models.crm.message import CrmConversation, CrmMessage
from app.models.crm.campaign import CrmCampaign
from app.models.crm.content import CrmContentPost
from app.models.crm.club import CrmPointsTransaction, CrmClubCoupon
from app.models.crm.inbox import CrmInboxThread, CrmTag, CrmCustomerTag
from app.models.crm.integration import (
    CrmIntegrationRecord, CrmReportDefinition, CrmReportRun,
    CrmEvent, CrmAdsMeta, CrmAdsGoogle,
)
from app.models.crm.calendar import CrmCalendarItem, CrmResource

__all__ = [
    "CrmIdentity",
    "CrmConversation", "CrmMessage",
    "CrmCampaign",
    "CrmContentPost",
    "CrmPointsTransaction", "CrmClubCoupon",
    "CrmInboxThread", "CrmTag", "CrmCustomerTag",
    "CrmIntegrationRecord", "CrmReportDefinition", "CrmReportRun",
    "CrmEvent", "CrmAdsMeta", "CrmAdsGoogle",
    "CrmCalendarItem", "CrmResource",
]
