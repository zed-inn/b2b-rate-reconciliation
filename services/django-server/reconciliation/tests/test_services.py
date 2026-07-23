from django.test import TestCase
from reconciliation.models import AuditRecord
from reconciliation.contracts import (
    BookingCreatedEvent, RateSnapshotCapturedEvent, BookingInvoicedEvent
)
from reconciliation.services.booking import process_booking_created
from reconciliation.services.snapshot import process_snapshot_captured
from reconciliation.services.invoice import process_invoice_captured
from datetime import datetime, timezone
from uuid import uuid4


class BookingServiceTests(TestCase):

    def _make_event(self, ref="SVC-BKG-001", base=17000, tax=1500):
        return BookingCreatedEvent(
            event_id=uuid4(),
            timestamp=datetime.now(timezone.utc),
            booking_ref=ref, supplier_code="WEBBEDS",
            quoted_base_rate=base, quoted_tax=tax, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
        )

    def test_creates_audit_record(self):
        process_booking_created(self._make_event())
        audit = AuditRecord.objects.get(booking_ref="SVC-BKG-001")

        self.assertEqual(audit.quoted_base, 17000)
        self.assertEqual(audit.quoted_tax, 1500)
        self.assertEqual(audit.supplier_code, "WEBBEDS")
        self.assertEqual(audit.status, "CREATED")

    def test_duplicate_event_updates_existing_row(self):
        """update_or_create with same booking_ref: created=False, defaults are UPDATED.
        Second call with base=18000 should overwrite the first call's base=17000."""
        process_booking_created(self._make_event(ref="SVC-DUP"))
        process_booking_created(self._make_event(ref="SVC-DUP", base=18000))

        count = AuditRecord.objects.filter(booking_ref="SVC-DUP").count()
        self.assertEqual(count, 1)
        audit = AuditRecord.objects.get(booking_ref="SVC-DUP")
        self.assertEqual(audit.quoted_base, 18000)


class SnapshotServiceTests(TestCase):

    def _seed_audit(self, ref="SVC-SNAP-001"):
        return AuditRecord.objects.create(
            booking_ref=ref, supplier_code="WEBBEDS",
            quoted_base=17000, quoted_tax=1500, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
            status="CREATED",
        )

    def test_updates_audit_with_snapshot_and_runs_matcher(self):
        self._seed_audit()
        event = RateSnapshotCapturedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="SVC-SNAP-001", supplier_code="WEBBEDS",
            snapshot_base_rate=19000, snapshot_tax=2000, snapshot_currency="INR",
        )
        process_snapshot_captured(event)

        audit = AuditRecord.objects.get(booking_ref="SVC-SNAP-001")
        self.assertEqual(audit.snapshot_base, 19000)
        self.assertEqual(audit.snapshot_tax, 2000)
        self.assertEqual(audit.status, "SNAPSHOT_DISCREPANCY")

    def test_snapshot_matching_quote_verifies(self):
        self._seed_audit(ref="SVC-SNAP-OK")
        event = RateSnapshotCapturedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="SVC-SNAP-OK", supplier_code="WEBBEDS",
            snapshot_base_rate=17000, snapshot_tax=1500, snapshot_currency="INR",
        )
        process_snapshot_captured(event)

        audit = AuditRecord.objects.get(booking_ref="SVC-SNAP-OK")
        self.assertEqual(audit.status, "VERIFIED_AT_SNAPSHOT")


class InvoiceServiceTests(TestCase):

    def _seed_audit(self, ref="SVC-INV-001"):
        return AuditRecord.objects.create(
            booking_ref=ref, supplier_code="TBO",
            quoted_base=17000, quoted_tax=1500, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
            status="CREATED",
        )

    def test_invoice_triggers_reconciliation(self):
        self._seed_audit()
        event = BookingInvoicedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="SVC-INV-001", supplier_code="TBO",
            invoiced_base_rate=17000, invoiced_tax=1500, invoiced_currency="INR",
        )
        process_invoice_captured(event)

        audit = AuditRecord.objects.get(booking_ref="SVC-INV-001")
        self.assertEqual(audit.status, "RECONCILED")
        self.assertEqual(audit.leakage_amount, 0)

    def test_invoice_overcharge_flags_discrepancy(self):
        self._seed_audit(ref="SVC-INV-OVER")
        event = BookingInvoicedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="SVC-INV-OVER", supplier_code="TBO",
            invoiced_base_rate=20000, invoiced_tax=2000, invoiced_currency="INR",
        )
        process_invoice_captured(event)

        audit = AuditRecord.objects.get(booking_ref="SVC-INV-OVER")
        self.assertEqual(audit.status, "INVOICE_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, 3500)


class EventualConsistencyTests(TestCase):
    
    def test_out_of_order_event_delivery(self):
        """
        Simulate an invoice event arriving before the booking.created event.
        Verifies that partial records are created and eventually reconciled.
        """
        # 1. Invoice arrives first (creates PENDING partial record)
        process_invoice_captured(BookingInvoicedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="OUT-OF-ORDER", supplier_code="TBO",
            invoiced_base_rate=20000, invoiced_tax=2000, invoiced_currency="INR"
        ))
        
        audit = AuditRecord.objects.get(booking_ref="OUT-OF-ORDER")
        self.assertEqual(audit.status, "PENDING")
        self.assertIsNone(audit.quoted_base)
        
        # 2. Booking event arrives late (completes record and triggers matcher)
        process_booking_created(BookingCreatedEvent(
            event_id=uuid4(), timestamp=datetime.now(timezone.utc),
            booking_ref="OUT-OF-ORDER", supplier_code="TBO",
            quoted_base_rate=17000, quoted_tax=1500, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
        ))
        
        audit.refresh_from_db()
        self.assertEqual(audit.status, "INVOICE_DISCREPANCY")
        self.assertEqual(audit.leakage_amount, 3500)
        self.assertEqual(audit.quoted_base, 17000)
