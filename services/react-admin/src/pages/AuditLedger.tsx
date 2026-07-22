import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCcw } from 'lucide-react';
import { api } from '@/libs/api';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { AuditLedgerResponse } from '@auditsys/shared';

export default function AuditLedger() {
  const [currentUrl, setCurrentUrl] = useState<string>('/api/audits/');
  const [showFlagged, setShowFlagged] = useState<boolean>(false);

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amountInCents / 100);
  };

  const handleFilterToggle = (flagged: boolean) => {
    setShowFlagged(flagged);
    if (flagged) {
      setCurrentUrl('/api/audits/?has_leakage=true');
    } else {
      setCurrentUrl('/api/audits/');
    }
  };

  const handlePaginate = (urlStr: string | null) => {
    if (urlStr) {
      const urlObj = new URL(urlStr);
      setCurrentUrl(urlObj.pathname + urlObj.search);
    }
  };

  const { data: response, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ['audits', currentUrl],
    queryFn: async () => {
      const res = await api.get<AuditLedgerResponse>(currentUrl);
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 seconds to balance freshness and API load
  });

  const audits = response?.results || [];
  const nextUrl = response?.next || null;
  const prevUrl = response?.previous || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <header>
          <h2 className="text-3xl font-bold tracking-tight">Audit Ledger</h2>
          <p className="text-muted-foreground mt-1">Real-time ingestion of booking discrepancy audits.</p>
        </header>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isPending || isPlaceholderData}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${isPending || isPlaceholderData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={showFlagged ? "default" : "outline"}
            onClick={() => handleFilterToggle(!showFlagged)}
          >
            {showFlagged ? "Showing Flagged" : "Show Flagged Only"}
          </Button>
        </div>
      </div>

      <Card>
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive text-sm font-medium border-b border-destructive/20 flex justify-between items-center">
            <span>Failed to load audit records. Please check the backend server.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Retry</Button>
          </div>
        )}
        <CardHeader>
          <CardTitle>Recent Audits</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans">Date</TableHead>
                <TableHead className="font-sans">Booking Ref</TableHead>
                <TableHead className="font-sans">Supplier Code</TableHead>
                <TableHead className="font-sans">Status</TableHead>
                <TableHead className="text-right font-sans">Leakage (₹)</TableHead>
                <TableHead className="text-right font-sans">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
              ) : audits.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit records found.</TableCell></TableRow>
              ) : (
                audits.map(audit => (
                  <TableRow key={audit.id} className={isPlaceholderData ? "opacity-50" : ""}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(audit.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{audit.booking_ref}</TableCell>
                    <TableCell>{audit.supplier_code}</TableCell>
                    <TableCell>
                      <Badge variant={audit.status.includes('DISCREPANCY') ? 'destructive' : 'default'}>
                        {audit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${audit.leakage_amount > 0 ? 'text-destructive' : ''}`}>
                      {formatCurrency(audit.leakage_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/audits/${audit.booking_ref}`} className="text-sm font-medium text-primary hover:underline">
                        View Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" disabled={!prevUrl || isPlaceholderData} onClick={() => handlePaginate(prevUrl)}>
              Previous
            </Button>
            <Button variant="outline" disabled={!nextUrl || isPlaceholderData} onClick={() => handlePaginate(nextUrl)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
