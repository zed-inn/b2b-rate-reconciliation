import logging
from reconciliation.models import AuditRecord

logger = logging.getLogger(__name__)
from reconciliation.contracts import BookingCreatedEvent
from reconciliation.services.matcher import perform_3_way_match

def process_booking_created(event: BookingCreatedEvent):
    audit, created = AuditRecord.objects.update_or_create(
        booking_ref=event.booking_ref,
        defaults={
            "supplier_code": event.supplier_code,
            "quoted_base": event.quoted_base_rate,
            "quoted_tax": event.quoted_tax,
            "quoted_currency": event.quoted_currency,
            "check_in_date": event.check_in_date,
            "check_out_date": event.check_out_date,
        }
    )
    if created or audit.status == "PENDING":
        audit.status = "CREATED"
        audit.save()
        
    logger.info(f"[Booking Service] Logged quote for: {event.booking_ref}")
    perform_3_way_match(audit)
