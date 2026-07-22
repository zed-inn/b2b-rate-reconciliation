import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  iterations: 10000,
};

export default function () {
  const payload = JSON.stringify({
    booking_ref: `K6-BKG-${__VU}-${__ITER}-${Math.floor(Math.random() * 10000)}`,
    supplier_code: 'WEBBEDS',
    quoted_base_rate: 17000,
    quoted_tax: 1500,
    quoted_currency: 'INR',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  });

  const res = http.post('http://api-gateway/api/bookings', payload, { 
    headers: { 'Content-Type': 'application/json' } 
  });

  check(res, {
    'is status 201 or 200': (r) => r.status === 201 || r.status === 200,
  });
}
