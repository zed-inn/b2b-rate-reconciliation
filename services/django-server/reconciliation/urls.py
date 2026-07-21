from django.urls import path
from .views import AuditRecordListView, AuditRecordDetailView

urlpatterns = [
    path('', AuditRecordListView.as_view(), name='audit-list'),
    path('<str:booking_ref>/', AuditRecordDetailView.as_view(), name='audit-detail'),
]
