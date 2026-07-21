import json
from pydantic import ValidationError
from reconciliation.contracts import BookingCreatedEvent, RateSnapshotCapturedEvent, BookingInvoicedEvent
from reconciliation.services.booking import process_booking_created
from reconciliation.services.snapshot import process_snapshot_captured
from reconciliation.services.invoice import process_invoice_captured

def route_event(routing_key: str, raw_body: bytes):
    raw_payload = json.loads(raw_body)
    
    if routing_key == "booking.created":
        event = BookingCreatedEvent.model_validate(raw_payload)
        process_booking_created(event)
    elif routing_key == "rate.snapshot.captured":
        event = RateSnapshotCapturedEvent.model_validate(raw_payload)
        process_snapshot_captured(event)
    elif routing_key == "booking.invoiced":
        event = BookingInvoicedEvent.model_validate(raw_payload)
        process_invoice_captured(event)
