"""
Registro central de modelos — Alembic los descubre desde acá
"""

from app.models.company import Company, IndustryType
from app.models.user import User, UserRole
from app.models.local import Local
from app.models.provider import Provider
from app.models.provider_contact import ProviderContact
from app.models.product import Product, ProductVariant
from app.models.ingreso import Ingreso, IngresoItem, IngresoStatus, IngresoType
from app.models.pedido import Pedido, PedidoItem, PedidoStatus
from app.models.sale import Sale, SaleItem, SaleType, SaleStatus
from app.models.stock_movement import StockMovement, MovementType

# Módulo de Compras / CONTROL REMITOS
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PurchaseOrderType
from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceType, PurchaseInvoiceStatus
from app.models.payment import BankAccount, PaymentVoucher, PaymentInvoiceLink, CreditNote, PaymentStatus

# Módulos de soporte
from app.models.transport import Transport, Shipment
from app.models.notification import Notification, AuditLog, NotificationType, NotificationStatus
from app.models.price_list import PriceListFile, PriceListItem
from app.models.kanban import KanbanBoard, KanbanColumn, KanbanCard, KanbanCardPriority
from app.models.mail_config import MailConfig
from app.models.improvement_note import ImprovementNote
from app.models.module import CompanyModule, MODULES_CATALOG
from app.models.plan import Plan, CompanySubscription, PlanTier, SubscriptionStatus

# Órdenes de Trabajo
from app.models.work_order import (
    WorkOrder, WorkOrderItem, WorkOrderHistory, WorkOrderChecklist,
    MechanicRate, WOStatus, WOPriority, WOItemType, WOItemStatus,
)

# Clientes / CRM
from app.models.customer import (
    Customer, CustomerCompany, Vehicle, AccountMovement,
    CustomerType, TaxCondition, FuelType,
    MovementType as AccountMovementType,
)

# CRM Avanzado (módulo completo)
from app.models.crm import (
    CrmIdentity, CrmConversation, CrmMessage, CrmCampaign,
    CrmContentPost, CrmPointsTransaction, CrmClubCoupon,
    CrmInboxThread, CrmTag, CrmCustomerTag,
    CrmIntegrationRecord, CrmReportDefinition, CrmReportRun,
    CrmEvent, CrmAdsMeta, CrmAdsGoogle,
    CrmCalendarItem, CrmResource,
)

# SUPERTREND — análisis de competencia y tendencias
from app.models.supertrend import CompetitorEntry, TrendIndicator, TrendDirection

# SUPERTREND ML — seguimiento de competencia en MercadoLibre
from app.models.ml_competitor import MLTrackedSeller, MLCompetitorSnapshot, MLCompetitorVariantSnapshot

# PUNTUACIÓN DE EMPLEADOS
from app.models.employee_score import EmployeeScore, CATEGORIAS_DEFAULT

# MÓDULO RRHH (Recursos Humanos — Naaloo style)
from app.models.rrhh import (
    Empleado, EstadoEmpleado, ModalidadEmpleado,
    Ausencia, TipoAusencia, EstadoAusencia,
    Fichaje, TipoFichaje, OrigenFichaje, EstadoFichaje,
    DocumentoRRHH, TipoDocumentoRRHH, EstadoFirma,
    ComunicacionRRHH, TipoComunicacion, LecturaComunicacion,
)

# MENSAJERÍA INTERNA
from app.models.message import Message

# DEPOSITO — gestión de depósito para indumentaria
from app.models.deposito import (
    StockLocal, Transferencia, TransferenciaItem,
    ConteoInventario, ConteoItem,
    TransferenciaEstado, ConteoEstado,
)

# MERCADOLIBRE — módulo de depósito y picking
from app.models.meli_order import MeliOrder
from app.models.meli_config import MeliConfig
from app.models.meli_webhook import MeliWebhookEvent

# CRM Avanzado (módulo completo)
from app.models.crm import (
    CrmIdentity, CrmMessage, CrmConversation, CrmCampaign,
    CrmContentPost, CrmPointsTransaction, CrmClubCoupon,
    CrmInboxThread, CrmTag, CrmCustomerTag,
    CrmIntegrationRecord, CrmReportDefinition, CrmReportRun, CrmEvent,
    CrmAdsMeta, CrmAdsGoogle, CrmCalendarItem, CrmResource,
)

# Sincronización, AFIP, Storage, WhatsApp, MercadoPago
from app.models.sync import (
    SyncEvent, DeviceRegistry, SyncConflict,
    AfipConfig, AfipQueue,
    StorageFile, WhatsAppMessage,
    MercadoPagoConfig, MercadoPagoTransaction,
    DeviceType, ConflictType, ConflictResolution,
    AfipAmbiente, AfipQueueStatus,
    StorageBackend, SyncPriority,
    WAMessageStatus, MPTransactionStatus,
)

__all__ = [
    "Company", "IndustryType", "User", "UserRole", "Local", "Provider", "ProviderContact",
    "Product", "ProductVariant",
    "Ingreso", "IngresoItem", "IngresoStatus", "IngresoType",
    "Pedido", "PedidoItem", "PedidoStatus",
    "Sale", "SaleItem", "SaleType", "SaleStatus",
    "StockMovement", "MovementType",
    # Compras
    "PurchaseOrder", "PurchaseOrderItem", "PurchaseOrderStatus", "PurchaseOrderType",
    "PurchaseInvoice", "PurchaseInvoiceItem", "PurchaseInvoiceType", "PurchaseInvoiceStatus",
    "BankAccount", "PaymentVoucher", "PaymentInvoiceLink", "CreditNote", "PaymentStatus",
    # Soporte
    "Transport", "Shipment",
    "Notification", "AuditLog", "NotificationType", "NotificationStatus",
    "PriceListFile", "PriceListItem",
    "KanbanBoard", "KanbanColumn", "KanbanCard", "KanbanCardPriority",
    "MailConfig",
    "ImprovementNote",
    "CompanyModule", "MODULES_CATALOG",
    # Planes / Licencias
    "Plan", "CompanySubscription", "PlanTier", "SubscriptionStatus",
    # Órdenes de Trabajo
    "WorkOrder", "WorkOrderItem", "WorkOrderHistory", "WorkOrderChecklist",
    "MechanicRate", "WOStatus", "WOPriority", "WOItemType", "WOItemStatus",
    # Clientes / CRM
    "Customer", "CustomerCompany", "Vehicle", "AccountMovement",
    "CustomerType", "TaxCondition", "FuelType", "AccountMovementType",
    # CRM Avanzado
    "CrmIdentity", "CrmConversation", "CrmMessage", "CrmCampaign",
    "CrmContentPost", "CrmPointsTransaction", "CrmClubCoupon",
    "CrmInboxThread", "CrmTag", "CrmCustomerTag",
    "CrmIntegrationRecord", "CrmReportDefinition", "CrmReportRun",
    "CrmEvent", "CrmAdsMeta", "CrmAdsGoogle",
    "CrmCalendarItem", "CrmResource",
    # SUPERTREND
    "CompetitorEntry", "TrendIndicator", "TrendDirection",
    # PUNTUACIÓN DE EMPLEADOS
    "EmployeeScore", "CATEGORIAS_DEFAULT",
    # MÓDULO RRHH
    "Empleado", "EstadoEmpleado", "ModalidadEmpleado",
    "Ausencia", "TipoAusencia", "EstadoAusencia",
    "Fichaje", "TipoFichaje", "OrigenFichaje", "EstadoFichaje",
    "DocumentoRRHH", "TipoDocumentoRRHH", "EstadoFirma",
    "ComunicacionRRHH", "TipoComunicacion", "LecturaComunicacion",
    # MENSAJERÍA INTERNA
    "Message",
    # DEPOSITO
    "StockLocal", "Transferencia", "TransferenciaItem",
    "ConteoInventario", "ConteoItem",
    "TransferenciaEstado", "ConteoEstado",
    # Sincronización / Infra
    "SyncEvent", "DeviceRegistry", "SyncConflict",
    "AfipConfig", "AfipQueue",
    "StorageFile", "WhatsAppMessage",
    "MercadoPagoConfig", "MercadoPagoTransaction",
    "DeviceType", "ConflictType", "ConflictResolution",
    "AfipAmbiente", "AfipQueueStatus",
    "StorageBackend", "SyncPriority",
    "WAMessageStatus", "MPTransactionStatus",
    # MERCADOLIBRE
    "MeliOrder", "MeliConfig", "MeliWebhookEvent",
    # CRM Avanzado
    "CrmIdentity", "CrmMessage", "CrmConversation", "CrmCampaign",
    "CrmContentPost", "CrmPointsTransaction", "CrmClubCoupon",
    "CrmInboxThread", "CrmTag", "CrmCustomerTag",
    "CrmIntegrationRecord", "CrmReportDefinition", "CrmReportRun", "CrmEvent",
    "CrmAdsMeta", "CrmAdsGoogle", "CrmCalendarItem", "CrmResource",
]
