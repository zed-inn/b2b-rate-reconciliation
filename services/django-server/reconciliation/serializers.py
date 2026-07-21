from rest_framework import serializers
from .models import AuditRecord

class AuditListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditRecord
        fields = ['id', 'booking_ref', 'supplier_code', 'status', 'leakage_amount', 'created_at']

class AuditDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditRecord
        fields = '__all__'
