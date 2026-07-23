from django.db import models

class AuditRecord(models.Model):
    booking_ref = models.CharField(max_length=50, unique=True, db_index=True)
    supplier_code = models.CharField(max_length=20)
    
    quoted_base = models.IntegerField(null=True, blank=True)
    quoted_tax = models.IntegerField(null=True, blank=True)
    quoted_currency = models.CharField(max_length=3, null=True, blank=True)
    
    snapshot_base = models.IntegerField(null=True, blank=True)
    snapshot_tax = models.IntegerField(null=True, blank=True)
    snapshot_currency = models.CharField(max_length=3, null=True, blank=True)
    
    invoiced_base = models.IntegerField(null=True, blank=True)
    invoiced_tax = models.IntegerField(null=True, blank=True)
    invoiced_currency = models.CharField(max_length=3, null=True, blank=True)
    
    check_in_date = models.DateTimeField(null=True, blank=True)
    check_out_date = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(max_length=30, default="PENDING", db_index=True)
    leakage_amount = models.IntegerField(default=0)
    discrepancy_breakdown = models.JSONField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.booking_ref} - {self.status}"
