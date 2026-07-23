import json
from django.test import TestCase
from pydantic import ValidationError
from reconciliation.services.router import route_event
from reconciliation.models import AuditRecord
from datetime import datetime, timezone
from uuid import uuid4


class RouterTests(TestCase):

    def _booking_payload(self, ref="RTR-001"):
        return json.dumps({
            "event_id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "booking_ref": ref, "supplier_code": "WEBBEDS",
            "quoted_base_rate": 17000, "quoted_tax": 1500, "quoted_currency": "INR",
            "check_in_date": "2026-08-15T00:00:00+00:00",
            "check_out_date": "2026-08-20T00:00:00+00:00",
        }).encode()

    def test_routes_booking_created(self):
        route_event("booking.created", self._booking_payload())
        self.assertTrue(AuditRecord.objects.filter(booking_ref="RTR-001").exists())

    def test_routes_snapshot_captured(self):
        AuditRecord.objects.create(
            booking_ref="RTR-002", supplier_code="WEBBEDS",
            quoted_base=17000, quoted_tax=1500, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
        )
        payload = json.dumps({
            "event_id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "booking_ref": "RTR-002", "supplier_code": "WEBBEDS",
            "snapshot_base_rate": 19000, "snapshot_tax": 2000, "snapshot_currency": "INR",
        }).encode()
        route_event("rate.snapshot.captured", payload)

        audit = AuditRecord.objects.get(booking_ref="RTR-002")
        self.assertEqual(audit.snapshot_base, 19000)

    def test_routes_booking_invoiced(self):
        AuditRecord.objects.create(
            booking_ref="RTR-003", supplier_code="TBO",
            quoted_base=17000, quoted_tax=1500, quoted_currency="INR",
            check_in_date=datetime(2026, 8, 15, tzinfo=timezone.utc),
            check_out_date=datetime(2026, 8, 20, tzinfo=timezone.utc),
        )
        payload = json.dumps({
            "event_id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "booking_ref": "RTR-003", "supplier_code": "TBO",
            "invoiced_base_rate": 17000, "invoiced_tax": 1500, "invoiced_currency": "INR",
        }).encode()
        route_event("booking.invoiced", payload)

        audit = AuditRecord.objects.get(booking_ref="RTR-003")
        self.assertEqual(audit.status, "RECONCILED")

    def test_rejects_malformed_payload(self):
        bad_payload = json.dumps({"garbage": "data"}).encode()
        with self.assertRaises(ValidationError):
            route_event("booking.created", bad_payload)
