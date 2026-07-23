import logging
from django.db import transaction
from reconciliation.models import AuditRecord

logger = logging.getLogger(__name__)
from reconciliation.contracts import RateSnapshotCapturedEvent
from reconciliation.services.matcher import perform_3_way_match

@transaction.atomic
def process_snapshot_captured(event: RateSnapshotCapturedEvent):
    audit, _ = AuditRecord.objects.update_or_create(
        booking_ref=event.booking_ref,
        defaults={
            "supplier_code": event.supplier_code,
            "snapshot_base": event.snapshot_base_rate,
            "snapshot_tax": event.snapshot_tax,
            "snapshot_currency": event.snapshot_currency,
        }
    )
    
    audit = AuditRecord.objects.select_for_update().get(id=audit.id)
    
    logger.info(f"[Snapshot Service] Logged snapshot for: {event.booking_ref}")
    perform_3_way_match(audit)
