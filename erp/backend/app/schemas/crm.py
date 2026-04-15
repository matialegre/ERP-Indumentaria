"""
Pydantic schemas for CRM module.

Migrated from standalone CRM — uses datetime instead of epoch ints,
keeps camelCase aliases for API compatibility.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Literals / Enums ───────────────────────────────────

ChannelSocial = Literal["instagram", "tiktok", "facebook"]
ChannelMessage = Literal["whatsapp", "email", "arnbaada"]
ChannelBroadcast = Literal["whatsapp", "email", "instagram", "facebook", "webchat"]
ChannelCampaign = Literal["email_marketing", "social", "ads_meta", "ads_google"]
LifecycleStatus = Literal["draft", "active", "paused", "completed", "failed"]
SimStatus = Literal["simulated", "real"]
Tier = Literal["bronze", "silver", "gold", "platinum"]


# ── Contacts ───────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    preferences: Dict[str, Any] | None = None
    club_mundo: bool = Field(default=False, alias="clubMundo")
    document: Optional[str] = None
    points: int = 0
    tier: Tier = "bronze"
    orders_count: int = Field(default=0, alias="ordersCount")
    total_spent: float = Field(default=0, alias="totalSpent")
    last_purchase_at: Optional[datetime] = Field(default=None, alias="lastPurchaseAt")

    model_config = ConfigDict(populate_by_name=True)


class ContactOut(ContactCreate):
    id: int
    company_id: int = Field(alias="companyId")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class Preferences(BaseModel):
    lang: Literal["es", "en"] = "es"
    topics: List[str] = []
    contact_policy: Literal["opt_in", "opt_out", "unknown"] = Field(
        default="unknown", alias="contactPolicy",
    )

    model_config = ConfigDict(populate_by_name=True)


# ── Identity ──────────────────────────────────────────

class IdentityCreate(BaseModel):
    customer_id: int = Field(alias="customerId")
    provider: str
    handle: str

    model_config = ConfigDict(populate_by_name=True)


class IdentityOut(IdentityCreate):
    id: int
    company_id: int = Field(alias="companyId")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Messages ──────────────────────────────────────────

class MessageSend(BaseModel):
    contact_id: int = Field(alias="contactId")
    channel: ChannelMessage
    content: str

    model_config = ConfigDict(populate_by_name=True)


class MessageOut(BaseModel):
    id: int
    contact_id: int = Field(alias="contactId")
    channel: ChannelMessage
    content: str
    status: Literal["queued", "sent", "failed", "received"]
    sim: Optional[SimStatus] = None
    direction: Optional[Literal["in", "out"]] = None
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class BulkSimRequest(BaseModel):
    channel: ChannelMessage
    contact_ids: List[int] = Field(alias="contactIds")
    content: str

    model_config = ConfigDict(populate_by_name=True)


class BulkSimResult(BaseModel):
    status: SimStatus
    channel: ChannelMessage
    contact_ids: List[int] = Field(alias="contactIds")
    content: str
    count: int

    model_config = ConfigDict(populate_by_name=True)


# ── Broadcast ─────────────────────────────────────────

class BroadcastSegment(BaseModel):
    tiers: List[Tier] | None = None
    min_points: Optional[int] = Field(default=None, alias="minPoints")
    club_mundo: Optional[bool] = Field(default=None, alias="clubMundo")

    model_config = ConfigDict(populate_by_name=True)


class BroadcastRequest(BaseModel):
    channels: List[ChannelBroadcast]
    content: str
    contact_ids: List[int] | None = Field(default=None, alias="contactIds")
    segment: BroadcastSegment | None = None

    model_config = ConfigDict(populate_by_name=True)


class BroadcastResponse(BaseModel):
    status: SimStatus
    totals: Dict[str, int]
    by_channel: Dict[str, int] | None = Field(default=None, alias="byChannel")

    model_config = ConfigDict(populate_by_name=True)


# ── Campaigns ─────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    channel: ChannelCampaign


class CampaignAction(BaseModel):
    action: Literal["launch", "pause", "complete"]


class CampaignOut(BaseModel):
    id: int
    company_id: int = Field(alias="companyId")
    name: str
    channel: ChannelCampaign
    status: LifecycleStatus
    created_at: datetime = Field(alias="createdAt")
    metrics: Dict[str, int] | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class CampaignStats(BaseModel):
    id: int
    metrics: Dict[str, int]


# ── Content Posts ─────────────────────────────────────

class ContentAsset(BaseModel):
    name: str
    type: Literal["image", "video", "other"]
    path: str
    channel: Optional[ChannelSocial] = None
    caption: Optional[str] = None
    channels: Optional[List[ChannelSocial]] = None
    captions: Optional[Dict[ChannelSocial, str]] = None


class ContentMetricsItem(BaseModel):
    views: int = 0
    saves: int = 0
    shares: int = 0
    likes: int = 0
    comments: int = 0


class ContentPostCreate(BaseModel):
    date: datetime
    title: Optional[str] = None
    description: Optional[str] = None
    brands: List[str] = []
    branches: List[str] = []
    channels: List[ChannelSocial] = []
    copies: Dict[ChannelSocial, str] = {}
    assets: List[ContentAsset] = []
    metrics: Dict[ChannelSocial, ContentMetricsItem] = {}
    status: Literal["draft", "scheduled", "published"] = "scheduled"


class ContentPostOut(ContentPostCreate):
    id: int
    company_id: int = Field(alias="companyId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ContentMetricsUpdate(BaseModel):
    metrics: Dict[ChannelSocial, ContentMetricsItem]


class ContentCatalogs(BaseModel):
    brands: List[str]
    branches: List[str]
    channels: List[ChannelSocial]


# ── Calendar / Resources ─────────────────────────────

class CalendarCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_at: datetime = Field(alias="startAt")
    end_at: Optional[datetime] = Field(default=None, alias="endAt")
    tags: List[str] = []
    scope: Literal["ops_publicity", "content"] = "content"

    model_config = ConfigDict(populate_by_name=True)


class CalendarOut(CalendarCreate):
    id: int
    company_id: int = Field(alias="companyId")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ResourceCreate(BaseModel):
    name: str
    type: Literal["image", "video", "copy", "document", "other"]
    url: Optional[str] = None
    scope: Literal["ops_publicity", "content"] = "content"


class ResourceOut(ResourceCreate):
    id: int
    company_id: int = Field(alias="companyId")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Integrations ──────────────────────────────────────

class IntegrationSyncResult(BaseModel):
    status: SimStatus
    synced: int
    errors: List[str]


# ── Reports ───────────────────────────────────────────

class ReportDefinition(BaseModel):
    id: int
    name: str
    query: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ReportRunRequest(BaseModel):
    definition_id: int = Field(alias="definitionId")
    params: Dict[str, Any]

    model_config = ConfigDict(populate_by_name=True)


class ReportRun(BaseModel):
    id: int
    definition_id: int = Field(alias="definitionId")
    params: Dict[str, Any]
    result: Dict[str, Any]
    created_at: datetime = Field(alias="createdAt")
    status: LifecycleStatus

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Events ────────────────────────────────────────────

class EventOut(BaseModel):
    id: int
    kind: str
    payload: Dict[str, Any]
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Ads Reports ───────────────────────────────────────

class AdReportRequest(BaseModel):
    since: datetime
    until: datetime
    metrics: List[str] | None = None
    filters: Dict[str, Any] | None = None


class AdReportResponse(BaseModel):
    status: SimStatus
    data: List[Dict[str, Any]]


# ── Analytics ─────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    vtex_sales: float = Field(alias="vtexSales")
    vtex_visits: int = Field(alias="vtexVisits")
    ig_followers: int = Field(alias="igFollowers")
    ads_spend: float = Field(alias="adsSpend")
    ads_conv: int = Field(alias="adsConv")
    roas: float
    deltas: Dict[str, float] | None = None

    model_config = ConfigDict(populate_by_name=True)


class TimeSeriesPoint(BaseModel):
    ts: datetime
    value: float


class Series(BaseModel):
    label: str
    points: List[TimeSeriesPoint]


class AnalyticsTimeseriesResponse(BaseModel):
    vtex: List[Series] | None = None
    ads: List[Series] | None = None
    social: List[Series] | None = None


# ── Gift Cards ────────────────────────────────────────

class GiftCardRequest(BaseModel):
    contact_id: int = Field(alias="contactId")
    amount: float
    expires_at: Optional[datetime] = Field(default=None, alias="expiresAt")

    model_config = ConfigDict(populate_by_name=True)


class GiftCardResponse(BaseModel):
    code: str
    status: SimStatus


# ── Inbox ─────────────────────────────────────────────

class InboxThreadOut(BaseModel):
    id: int
    customer_id: int = Field(alias="customerId")
    company_id: int = Field(alias="companyId")
    status: Literal["open", "pending", "resolved"]
    assignee_user_id: Optional[int] = Field(default=None, alias="assigneeUserId")
    tags: List[str] = []
    last_seen_at: Optional[datetime] = Field(default=None, alias="lastSeenAt")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ThreadAssignRequest(BaseModel):
    assignee_user_id: Optional[int] = Field(alias="assigneeUserId")

    model_config = ConfigDict(populate_by_name=True)


# ── Club (Points & Coupons) ──────────────────────────

class PointsTransactionOut(BaseModel):
    id: int
    customer_id: int = Field(alias="customerId")
    amount: int
    description: str
    transaction_type: Literal["earn", "redeem", "bonus", "adjustment"] = Field(
        alias="transactionType",
    )
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ClubCouponCreate(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    points_cost: int = Field(alias="pointsCost")
    discount_type: Literal["percentage", "fixed_amount"] = Field(alias="discountType")
    discount_value: int = Field(alias="discountValue")
    min_purchase: Optional[int] = Field(default=None, alias="minPurchase")
    valid_from: datetime = Field(alias="validFrom")
    valid_until: Optional[datetime] = Field(default=None, alias="validUntil")
    is_active: bool = Field(default=True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class ClubCouponOut(ClubCouponCreate):
    id: int
    company_id: int = Field(alias="companyId")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
