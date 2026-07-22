import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/libs/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FrontendInvoiceItemSchema = z.object({
  booking_ref: z.string().min(1, 'Required').max(50),
  supplier_code: z.string(),
  invoiced_base_rate: z.coerce.number().min(0),
  invoiced_tax: z.coerce.number().min(0),
  invoiced_currency: z.literal('INR'),
  invoice_date: z.any(),
});

const FormSchema = z.object({ invoices: z.array(FrontendInvoiceItemSchema) });

export default function UploadInvoices() {
  const todayStr = new Date().toISOString().split('T')[0];

  const handleDecimalChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (...event: any[]) => void) => {
    let val = e.target.value;
    if (val.includes('.')) {
      const parts = val.split('.');
      if (parts[1].length > 2) {
        val = `${parts[0]}.${parts[1].slice(0, 2)}`;
      }
    }
    onChange(val);
  };

  const form = useForm<any>({
    resolver: zodResolver(FormSchema),
    defaultValues: { invoices: [{ booking_ref: '', supplier_code: 'WEBBEDS', invoiced_base_rate: '', invoiced_tax: '', invoiced_currency: 'INR', invoice_date: new Date(todayStr) }] }
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "invoices" });

  const onSubmit = async (data: any) => {
    try {
      const payload = data.invoices.map((inv: any) => ({
        ...inv,
        invoiced_base_rate: Math.round(Number(inv.invoiced_base_rate) * 100),
        invoiced_tax: Math.round(Number(inv.invoiced_tax) * 100),
      }));
      await api.post('/api/invoices', payload);
      alert('Invoices Uploaded!');
      form.reset({ invoices: [{ booking_ref: '', supplier_code: 'WEBBEDS', invoiced_base_rate: '', invoiced_tax: '', invoiced_currency: 'INR', invoice_date: new Date(todayStr) }] });
    } catch (err) {
      console.error(err);
      alert('Failed to upload invoices');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Upload Invoices</h2>
        <p className="text-muted-foreground mt-1">Simulate the nightly supplier invoice feed.</p>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead>Supplier Code</TableHead>
                      <TableHead>Base Rate (₹)</TableHead>
                      <TableHead>Tax (₹)</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField control={form.control} name={`invoices.${index}.booking_ref` as any} render={({ field }: { field: any }) => (
                            <FormItem><FormControl><Input placeholder="BKG-..." {...field} /></FormControl></FormItem>
                          )} />
                        </TableCell>
                        <TableCell>
                          <FormField control={form.control} name={`invoices.${index}.supplier_code` as any} render={({ field }: { field: any }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="WEBBEDS">WEBBEDS</SelectItem>
                                  <SelectItem value="TBO">TBO</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </TableCell>
                        <TableCell>
                          <FormField control={form.control} name={`invoices.${index}.invoiced_base_rate` as any} render={({ field }: { field: any }) => (
                            <FormItem><FormControl><Input type="number" step="0.01" {...field} onChange={e => handleDecimalChange(e, field.onChange)} /></FormControl></FormItem>
                          )} />
                        </TableCell>
                        <TableCell>
                          <FormField control={form.control} name={`invoices.${index}.invoiced_tax` as any} render={({ field }: { field: any }) => (
                            <FormItem><FormControl><Input type="number" step="0.01" {...field} onChange={e => handleDecimalChange(e, field.onChange)} /></FormControl></FormItem>
                          )} />
                        </TableCell>
                        <TableCell>
                          <FormField control={form.control} name={`invoices.${index}.invoice_date` as any} render={({ field }: { field: any }) => (
                            <FormItem><FormControl><Input type="date" min={todayStr} {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(new Date(e.target.value))} className="w-36" /></FormControl></FormItem>
                          )} />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" className="text-destructive" onClick={() => remove(index)}>X</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 justify-between">
                <Button type="button" variant="outline" onClick={() => append({ booking_ref: '', supplier_code: 'WEBBEDS', invoiced_base_rate: '', invoiced_tax: '', invoiced_currency: 'INR', invoice_date: new Date(todayStr) })}>
                  + Add Row
                </Button>
                <Button type="submit">Submit Invoices</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
