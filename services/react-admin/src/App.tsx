import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import AuditLedger from '@/pages/AuditLedger';
import AuditDetail from '@/pages/AuditDetail';
import SupplierRisk from '@/pages/SupplierRisk';
import MakeBooking from '@/pages/MakeBooking';
import UploadInvoices from '@/pages/UploadInvoices';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<AuditLedger />} />
          <Route path="audits/:bookingRef" element={<AuditDetail />} />
          <Route path="risk" element={<SupplierRisk />} />
          <Route path="bookings/new" element={<MakeBooking />} />
          <Route path="invoices/upload" element={<UploadInvoices />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
