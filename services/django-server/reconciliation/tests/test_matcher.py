from django.test import TestCase
from reconciliation.models import AuditRecord
from reconciliation.services.matcher import perform_3_way_match
from anomalies.models import SupplierRisk
from datetime import datetime, timezone


class MatcherInvoiceTests(TestCase):
    """Tests for the invoice stage of the 3-way match algorithm."""

    def _create_audit(self, **overrides):
        defaults = {
            "booking_ref": "TEST-BKG-001",
            "supplier_code": "WEBBEDS",
            "quoted_base": 17000,
            "quoted_tax": 1500,
            "quoted_currency": "INR",
            "check_in_date": datetime(2026, 8, 15, tzinfo=timezone.utc),
            "check_out_date": datetime(2026, 8, 20, tzinfo=timezone.utc),
            "status": "CREATED",
        }
        defaults.update(overrides)
        return AuditRecord.objects.create(**defaults)

    def test_invoice_matches_quote_exactly(self):
        """Invoiced total == quoted total -> RECONCILED, zero leakage."""
        audit = self._create_audit(invoiced_base=17000, invoiced_tax=1500)
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "RECONCILED")
        self.assertEqual(audit.leakage_amount, 0)

    def test_invoice_overcharges(self):
        """Supplier invoices more than quoted -> INVOICE_DISCREPANCY, positive leakage."""
        audit = self._create_audit(invoiced_base=19000, invoiced_tax=2000)
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "INVOICE_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, 2500)  # (19000+2000) - (17000+1500)
        self.assertEqual(audit.discrepancy_breakdown["quoted"], 18500)
        self.assertEqual(audit.discrepancy_breakdown["invoiced"], 21000)
        self.assertEqual(audit.discrepancy_breakdown["difference"], 2500)
        self.assertEqual(audit.discrepancy_breakdown["currency"], "INR")
        self.assertEqual(audit.discrepancy_breakdown["stage"], "invoice")

    def test_invoice_undercharges(self):
        """Supplier invoices less than quoted -> negative leakage (credit to platform)."""
        audit = self._create_audit(invoiced_base=15000, invoiced_tax=1500)
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "INVOICE_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, -2000)

    def test_graceful_degradation_no_snapshot(self):
        """Missing snapshot should not block invoice reconciliation — 2-way match runs."""
        audit = self._create_audit(
            snapshot_base=None, snapshot_tax=None,
            invoiced_base=19000, invoiced_tax=1500,
        )
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "INVOICE_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, 2000)

    def test_reconciled_updates_risk_passed(self):
        """RECONCILED -> update_supplier_risk(is_failed=False)."""
        audit = self._create_audit(invoiced_base=17000, invoiced_tax=1500)
        perform_3_way_match(audit)

        risk = SupplierRisk.objects.get(supplier_code="WEBBEDS")
        self.assertEqual(risk.total_audits, 1)
        self.assertEqual(risk.failed_audits, 0)
        self.assertEqual(risk.risk_score, 0.0)

    def test_discrepancy_updates_risk_failed(self):
        """INVOICE_DISCREPANCY -> update_supplier_risk(is_failed=True)."""
        audit = self._create_audit(invoiced_base=20000, invoiced_tax=2000)
        perform_3_way_match(audit)

        risk = SupplierRisk.objects.get(supplier_code="WEBBEDS")
        self.assertEqual(risk.total_audits, 1)
        self.assertEqual(risk.failed_audits, 1)
        self.assertEqual(risk.risk_score, 100.0)

    def test_idempotent_matcher_no_double_risk(self):
        """The original_status guard prevents update_supplier_risk from being called
        on a second invocation when audit is already RECONCILED."""
        audit = self._create_audit(invoiced_base=17000, invoiced_tax=1500)
        perform_3_way_match(audit)
        perform_3_way_match(audit)  # status is already RECONCILED -> guard skips

        risk = SupplierRisk.objects.get(supplier_code="WEBBEDS")
        self.assertEqual(risk.total_audits, 1)  # not 2


class MatcherSnapshotTests(TestCase):
    """Tests for the snapshot stage (elif branch) of the 3-way match algorithm."""

    def _create_audit(self, **overrides):
        defaults = {
            "booking_ref": "TEST-SNAP-001",
            "supplier_code": "TBO",
            "quoted_base": 17000,
            "quoted_tax": 1500,
            "quoted_currency": "INR",
            "check_in_date": datetime(2026, 8, 15, tzinfo=timezone.utc),
            "check_out_date": datetime(2026, 8, 20, tzinfo=timezone.utc),
            "status": "CREATED",
        }
        defaults.update(overrides)
        return AuditRecord.objects.create(**defaults)

    def test_snapshot_matches_quote(self):
        """Snapshot total == quoted total -> VERIFIED_AT_SNAPSHOT."""
        audit = self._create_audit(snapshot_base=17000, snapshot_tax=1500)
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "VERIFIED_AT_SNAPSHOT")
        self.assertEqual(audit.leakage_amount, 0)

    def test_snapshot_drifted(self):
        """Snapshot rate != quoted rate -> SNAPSHOT_DISCREPANCY."""
        audit = self._create_audit(snapshot_base=19000, snapshot_tax=2000)
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "SNAPSHOT_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, 2500)
        self.assertEqual(audit.discrepancy_breakdown["quoted"], 18500)
        self.assertEqual(audit.discrepancy_breakdown["snapshot"], 21000)
        self.assertEqual(audit.discrepancy_breakdown["stage"], "snapshot")

    def test_invoice_branch_takes_priority(self):
        """When both snapshot and invoice exist, the if branch runs (not elif).
        Invoice matches quote -> RECONCILED, snapshot drift is ignored."""
        audit = self._create_audit(
            snapshot_base=19000, snapshot_tax=2000,
            invoiced_base=17000, invoiced_tax=1500,
        )
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "RECONCILED")
        self.assertEqual(audit.leakage_amount, 0)

    def test_only_quote_present_no_change(self):
        """Neither snapshot nor invoice exists -> neither branch runs."""
        audit = self._create_audit()
        perform_3_way_match(audit)
        audit.refresh_from_db()

        self.assertEqual(audit.status, "CREATED")
