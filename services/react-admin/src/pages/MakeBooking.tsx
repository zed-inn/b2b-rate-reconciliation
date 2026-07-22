import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/libs/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';

const FrontendBookingSchema = z.object({
  booking_ref: z.string().min(1, 'Required').max(50),
  supplier_code: z.string(),
  quoted_base_rate: z.coerce.number().min(0),
  quoted_tax: z.coerce.number().min(0),
  quoted_currency: z.literal('INR'),
  check_in_date: z.any(),
  check_out_date: z.any(),
});

export default function MakeBooking() {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

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
    resolver: zodResolver(FrontendBookingSchema),
    defaultValues: { 
      booking_ref: '', 
      supplier_code: 'WEBBEDS', 
      quoted_base_rate: '', 
      quoted_tax: '', 
      quoted_currency: 'INR', 
      check_in_date: new Date(todayStr), 
      check_out_date: new Date(tomorrowStr)
    }
  });

  const checkInDate = form.watch('check_in_date');
  const checkInDateStr = checkInDate ? new Date(checkInDate).toISOString().split('T')[0] : todayStr;

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        ...data,
        quoted_base_rate: Math.round(Number(data.quoted_base_rate) * 100),
        quoted_tax: Math.round(Number(data.quoted_tax) * 100),
      };
      await api.post('/api/bookings', payload);
      alert('Booking Dispatched!');
      form.reset();
    } catch (err) {
      console.error(err);
      alert('Failed to dispatch booking');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Make Booking</h2>
        <p className="text-muted-foreground mt-1">Simulate a user creating a booking in the system.</p>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="booking_ref" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Booking Reference</FormLabel><FormControl><Input placeholder="BKG-1001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="supplier_code" render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="WEBBEDS">WEBBEDS</SelectItem>
                        <SelectItem value="TBO">TBO</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="quoted_base_rate" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Base Rate (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => handleDecimalChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="quoted_tax" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Tax (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => handleDecimalChange(e, field.onChange)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="quoted_currency" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Currency</FormLabel><FormControl><Input disabled {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="check_in_date" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Check-in Date</FormLabel><FormControl><Input type="date" min={todayStr} {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(new Date(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="check_out_date" render={({ field }: { field: any }) => (
                  <FormItem><FormLabel>Check-out Date</FormLabel><FormControl><Input type="date" min={checkInDateStr} {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(new Date(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full">Dispatch Booking Event</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
