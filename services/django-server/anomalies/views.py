from rest_framework import generics
from .models import SupplierRisk
from .serializers import SupplierRiskSerializer

class SupplierRiskLeaderboardView(generics.ListAPIView):
    queryset = SupplierRisk.objects.all().order_by('-risk_score')
    serializer_class = SupplierRiskSerializer
