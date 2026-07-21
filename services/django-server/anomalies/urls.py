from django.urls import path
from .views import SupplierRiskLeaderboardView

urlpatterns = [
    path('risk-scores/', SupplierRiskLeaderboardView.as_view(), name='risk-leaderboard'),
]
