from rest_framework import generics
from rest_framework.pagination import CursorPagination
from .models import AuditRecord
from .serializers import AuditListSerializer, AuditDetailSerializer

class AuditCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'

class AuditRecordListView(generics.ListAPIView):
    serializer_class = AuditListSerializer
    pagination_class = AuditCursorPagination

    def get_queryset(self):
        queryset = AuditRecord.objects.all()
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        has_leakage = self.request.query_params.get('has_leakage', None)
        if has_leakage == 'true':
            queryset = queryset.filter(leakage_amount__gt=0)
            
        return queryset

class AuditRecordDetailView(generics.RetrieveAPIView):
    queryset = AuditRecord.objects.all()
    serializer_class = AuditDetailSerializer
    lookup_field = 'booking_ref'
