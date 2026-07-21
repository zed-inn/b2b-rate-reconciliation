from rest_framework import serializers
from .models import SupplierRisk

class SupplierRiskSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierRisk
        fields = '__all__'
