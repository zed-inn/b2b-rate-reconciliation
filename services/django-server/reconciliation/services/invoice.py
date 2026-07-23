import logging
from django.db import transaction
from reconciliation.models import AuditRecord

logger = logging.getLogger(__name__)
from reconciliation.contracts import BookingInvoicedEvent
from reconciliation.services.matcher import perform_3_way_match

@transaction.atomic
def process_invoice_captured(event: BookingInvoicedEvent):
    audit, _ = AuditRecord.objects.update_or_create(
        booking_ref=event.booking_ref,
        defaults={
            "supplier_code": event.supplier_code,
            "invoiced_base": event.invoiced_base_rate,
            "invoiced_tax": event.invoiced_tax,
            "invoiced_currency": event.invoiced_currency,
        }
    )

    audit = AuditRecord.objects.select_for_update().get(id=audit.id)
    
    logger.info(f"[Invoice Service] Logged invoice for: {event.booking_ref}")
    perform_3_way_match(audit)
