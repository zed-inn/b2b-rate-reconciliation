from anomalies.models import SupplierRisk

def update_supplier_risk(supplier_code: str, is_failed: bool):
    risk, _ = SupplierRisk.objects.get_or_create(supplier_code=supplier_code)
    risk.total_audits += 1
    if is_failed:
        risk.failed_audits += 1
    risk.risk_score = (risk.failed_audits / risk.total_audits) * 100
    risk.save()
