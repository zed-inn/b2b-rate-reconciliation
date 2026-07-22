import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import AuditLedger from '@/pages/AuditLedger';
import AuditDetail from '@/pages/AuditDetail';
import SupplierRisk from '@/pages/SupplierRisk';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<AuditLedger />} />
          <Route path="audits/:bookingRef" element={<AuditDetail />} />
          <Route path="risk" element={<SupplierRisk />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
