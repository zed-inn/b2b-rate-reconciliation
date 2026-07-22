import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useParams, Link } from 'react-router-dom';
import { Loader2, RefreshCcw } from 'lucide-react';
import { api } from '@/libs/api';
import { useQuery } from '@tanstack/react-query';
import type { AuditDetailedResponse } from '@auditsys/shared';

export default function AuditDetail() {
  const { bookingRef } = useParams();

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountInCents / 100);
  };

  const { data: audit, isPending: isAuditLoading, isError: isAuditError, refetch: refetchAudit, isFetching: isAuditFetching } = useQuery({
    queryKey: ['audit', bookingRef],
    queryFn: async () => {
      const res = await api.get<AuditDetailedResponse>(`/api/audits/${bookingRef}/`);
      return res.data;
    },
    enabled: !!bookingRef,
    staleTime: 1000 * 30, // 30 seconds
  });

  const { data: snapshotData, refetch: refetchSnapshot, isFetching: isSnapshotFetching } = useQuery({
    queryKey: ['snapshot', bookingRef],
    queryFn: async () => {
      const res = await api.get(`/api/snapshots/${bookingRef}`);
      return res.data;
    },
    enabled: !!bookingRef && audit?.status === 'SNAPSHOT_DISCREPANCY',
  });

  const handleRefresh = () => {
    refetchAudit();
    if (audit?.status === 'SNAPSHOT_DISCREPANCY') {
      refetchSnapshot();
    }
  };

  const isRefreshing = isAuditFetching || isSnapshotFetching;

  if (isAuditLoading) return <div className="p-16 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>;
  if (isAuditError) return (
    <div className="p-16 flex flex-col items-center justify-center gap-4 text-destructive">
      <span className="font-medium text-lg">Failed to load audit details.</span>
      <Button variant="outline" onClick={() => refetchAudit()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Retry Connection</Button>
    </div>
  );
  if (!audit) return <div className="p-8 text-destructive">Audit not found.</div>;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          &larr; Back to Ledger
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Audit: {audit.booking_ref}</h2>
            <p className="text-muted-foreground mt-1">Supplier: {audit.supplier_code}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={audit.status.includes('DISCREPANCY') ? 'destructive' : 'default'} className="text-lg px-4 py-1">
              {audit.status}
            </Badge>
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Quoted Total</span>
              <span className="font-mono font-medium">{formatCurrency(audit.quoted_base + audit.quoted_tax)}</span>
            </div>
            {audit.snapshot_base !== null && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Snapshot Total</span>
                <span className="font-mono font-medium">{formatCurrency((audit.snapshot_base || 0) + (audit.snapshot_tax || 0))}</span>
              </div>
            )}
            {audit.invoiced_base !== null && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Invoiced Total</span>
                <span className="font-mono font-medium">{formatCurrency((audit.invoiced_base || 0) + (audit.invoiced_tax || 0))}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="font-bold">Total Leakage</span>
              <span className={`font-mono font-bold ${audit.leakage_amount > 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(audit.leakage_amount)}
              </span>
            </div>
          </CardContent>
        </Card>

        {audit.discrepancy_breakdown && (
          <Card>
            <CardHeader>
              <CardTitle>Discrepancy Engine Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Detection Stage</span>
                <Badge variant="secondary" className="uppercase">{audit.discrepancy_breakdown.stage || 'UNKNOWN'}</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-mono">{audit.discrepancy_breakdown.currency}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-muted-foreground">Audit Timestamp</span>
                <span className="text-muted-foreground">{new Date(audit.created_at).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {audit?.status === 'SNAPSHOT_DISCREPANCY' && snapshotData && (
        <Card className="mt-6 md:col-span-2 shadow-sm border">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Raw MongoDB Evidence</CardTitle>
            <div className="text-sm text-muted-foreground">Supplier responses captured at snapshot time</div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div><span className="text-sm text-muted-foreground">Captured</span><p className="font-mono">{new Date(snapshotData.capturedAt).toLocaleString()}</p></div>
              <div><span className="text-sm text-muted-foreground">Base Rate</span><p className="font-mono font-bold">{formatCurrency(snapshotData.normalizedRates.baseRate)}</p></div>
              <div><span className="text-sm text-muted-foreground">Tax</span><p className="font-mono font-bold">{formatCurrency(snapshotData.normalizedRates.tax)}</p></div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Raw Supplier Response</span>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono border">
                {JSON.stringify(snapshotData.rawSupplierResponse, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
