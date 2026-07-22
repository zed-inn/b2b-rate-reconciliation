import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw } from 'lucide-react';
import { api } from '@/libs/api';
import { useQuery } from '@tanstack/react-query';
import type { SupplierRiskItem } from '@auditsys/shared';

export default function SupplierRisk() {
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ['risk-scores'],
    queryFn: async () => {
      const res = await api.get<SupplierRiskItem[]>('/api/anomalies/risk-scores/');
      return res.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <header>
          <h2 className="text-3xl font-bold tracking-tight">Supplier Risk Leaderboard</h2>
          <p className="text-muted-foreground mt-1">Aggregated historical failure rates by supplier.</p>
        </header>
        <Button variant="outline" onClick={() => refetch()} disabled={isPending}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive text-sm font-medium border-b border-destructive/20 flex justify-between items-center">
            <span>Failed to load supplier risk scores. Please check the backend server.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Retry</Button>
          </div>
        )}
        <CardHeader>
          <CardTitle>Risk Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-sans">Supplier Code</TableHead>
                <TableHead className="text-right font-sans">Total Audits</TableHead>
                <TableHead className="text-right font-sans">Failed Audits</TableHead>
                <TableHead className="text-right font-sans">Risk Score</TableHead>
                <TableHead className="text-right font-sans">Last Calculated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell></TableRow>
              ) : (
                data.map(supplier => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.supplier_code}</TableCell>
                    <TableCell className="text-right font-mono">{supplier.total_audits}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{supplier.failed_audits}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">
                      {supplier.risk_score.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      {supplier.last_calculated ? new Date(supplier.last_calculated).toLocaleDateString() : 'Never'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
