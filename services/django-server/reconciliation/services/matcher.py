import logging
from reconciliation.models import AuditRecord

logger = logging.getLogger(__name__)
from anomalies.services.risk import update_supplier_risk

def perform_3_way_match(audit: AuditRecord):
    original_status = audit.status
    
    # invoice checking, will skip snapshots if even present
    if audit.quoted_base is not None and audit.invoiced_base is not None:
        quoted_total = audit.quoted_base + audit.quoted_tax
        invoiced_total = audit.invoiced_base + audit.invoiced_tax
        final_leakage = invoiced_total - quoted_total
        
        audit.leakage_amount = final_leakage
        
        if final_leakage != 0:
            if original_status != "INVOICE_DISCREPANCY":
                audit.status = "INVOICE_DISCREPANCY"
                audit.discrepancy_breakdown = {
                    "quoted": quoted_total,
                    "invoiced": invoiced_total,
                    "difference": final_leakage,
                    "currency": audit.quoted_currency,
                    "stage": "invoice"
                }
                update_supplier_risk(audit.supplier_code, is_failed=True)
                logger.info(f"[Matcher] FINAL LEAKAGE DETECTED for {audit.booking_ref}! Leakage: {final_leakage}")
        else:
            if original_status != "RECONCILED":
                audit.status = "RECONCILED"
                update_supplier_risk(audit.supplier_code, is_failed=False)
                logger.info(f"[Matcher] Successfully reconciled final invoice for {audit.booking_ref}")
                
    # snapshot checking, only if invoice isn't already present
    elif audit.quoted_base is not None and audit.snapshot_base is not None:
        quoted_total = audit.quoted_base + audit.quoted_tax
        snapshot_total = audit.snapshot_base + audit.snapshot_tax
        snapshot_leakage = snapshot_total - quoted_total
        
        audit.leakage_amount = snapshot_leakage
        
        if snapshot_leakage != 0:
            if original_status != "SNAPSHOT_DISCREPANCY":
                audit.status = "SNAPSHOT_DISCREPANCY"
                
                audit.discrepancy_breakdown = {
                    "quoted": quoted_total,
                    "snapshot": snapshot_total,
                    "difference": snapshot_leakage,
                    "currency": audit.quoted_currency,
                    "stage": "snapshot"
                }
                logger.info(f"[Matcher] SNAPSHOT DRIFT WARNING for {audit.booking_ref}! Leakage: {snapshot_leakage}")
        else:
            if original_status != "VERIFIED_AT_SNAPSHOT":
                audit.status = "VERIFIED_AT_SNAPSHOT"
                logger.info(f"[Matcher] Snapshot rates verified for {audit.booking_ref}")
            
    audit.save()
