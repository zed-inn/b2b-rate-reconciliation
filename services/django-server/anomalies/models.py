from django.db import models

class SupplierRisk(models.Model):
    supplier_code = models.CharField(max_length=20, unique=True)
    total_audits = models.IntegerField(default=0)
    failed_audits = models.IntegerField(default=0)
    risk_score = models.FloatField(default=0.0)
    last_calculated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.supplier_code} - Risk: {self.risk_score}%"
