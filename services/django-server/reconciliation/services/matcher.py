from reconciliation.models import AuditRecord

def perform_3_way_match(audit: AuditRecord):
    # TODO: currently only performs a 2-way match (Quote vs Snapshot)
    # this will be upgraded to a true 3-way match once Invoice ingestion is implemented
    if audit.quoted_base is None or audit.snapshot_base is None:
        return 
        
    quoted_total = audit.quoted_base + audit.quoted_tax
    snapshot_total = audit.snapshot_base + audit.snapshot_tax
    leakage = snapshot_total - quoted_total
    
    audit.leakage_amount = leakage
    
    if leakage > 0:
        audit.status = "DISCREPANCY_DETECTED"
        audit.discrepancy_breakdown = {
            "quoted": quoted_total,
            "snapshot": snapshot_total,
            "difference": leakage,
            "currency": audit.quoted_currency
        }
        print(f"[Matcher] Discrepancy detected for {audit.booking_ref}! Leakage: {leakage}")
    else:
        audit.status = "VERIFIED_AT_SNAPSHOT"
        print(f"[Matcher] Rates verified for {audit.booking_ref}")
        
    audit.save()
