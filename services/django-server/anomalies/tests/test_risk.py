from django.test import TestCase
from anomalies.models import SupplierRisk
from anomalies.services.risk import update_supplier_risk


class SupplierRiskTests(TestCase):

    def test_first_passed_audit_creates_record(self):
        update_supplier_risk("WEBBEDS", is_failed=False)
        risk = SupplierRisk.objects.get(supplier_code="WEBBEDS")
        self.assertEqual(risk.total_audits, 1)
        self.assertEqual(risk.failed_audits, 0)
        self.assertEqual(risk.risk_score, 0.0)

    def test_first_failed_audit(self):
        update_supplier_risk("TBO", is_failed=True)
        risk = SupplierRisk.objects.get(supplier_code="TBO")
        self.assertEqual(risk.total_audits, 1)
        self.assertEqual(risk.failed_audits, 1)
        self.assertEqual(risk.risk_score, 100.0)

    def test_mixed_audits_score(self):
        """7 passed + 3 failed = 30.0%."""
        for _ in range(7):
            update_supplier_risk("MIXED", is_failed=False)
        for _ in range(3):
            update_supplier_risk("MIXED", is_failed=True)

        risk = SupplierRisk.objects.get(supplier_code="MIXED")
        self.assertEqual(risk.total_audits, 10)
        self.assertEqual(risk.failed_audits, 3)
        self.assertEqual(risk.risk_score, 30.0)

    def test_suppliers_isolated(self):
        update_supplier_risk("WEBBEDS", is_failed=True)
        update_supplier_risk("TBO", is_failed=False)

        self.assertEqual(SupplierRisk.objects.get(supplier_code="WEBBEDS").risk_score, 100.0)
        self.assertEqual(SupplierRisk.objects.get(supplier_code="TBO").risk_score, 0.0)
