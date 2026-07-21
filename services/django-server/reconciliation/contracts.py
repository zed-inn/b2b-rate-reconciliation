from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class BookingCreatedEvent(BaseModel):
    event_id: UUID
    timestamp: datetime
    booking_ref: str = Field(..., max_length=50)
    supplier_code: str = Field(..., max_length=20)
    quoted_base_rate: int = Field(..., ge=0)
    quoted_tax: int = Field(..., ge=0)
    quoted_currency: str = Field(..., max_length=3)
    check_in_date: datetime
    check_out_date: datetime

class RateSnapshotCapturedEvent(BaseModel):
    event_id: UUID
    timestamp: datetime
    booking_ref: str = Field(..., max_length=50)
    supplier_code: str = Field(..., max_length=20)
    snapshot_base_rate: int = Field(..., ge=0)
    snapshot_tax: int = Field(..., ge=0)
    snapshot_currency: str = Field(..., max_length=3)

class BookingInvoicedEvent(BaseModel):
    event_id: UUID
    timestamp: datetime
    booking_ref: str = Field(..., max_length=50)
    supplier_code: str = Field(..., max_length=20)
    invoiced_base_rate: int = Field(..., ge=0)
    invoiced_tax: int = Field(..., ge=0)
    invoiced_currency: str = Field(..., max_length=3)
