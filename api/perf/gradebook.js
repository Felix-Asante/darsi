import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: { teachers: { executor: 'constant-vus', vus: 40, duration: '2m' } },
  thresholds: { http_req_duration: ['p(95)<1500'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL}/api/v1/assessment/classes/${__ENV.CLASS_ID}/gradebook`, {
    headers: { cookie: __ENV.COOKIE, origin: __ENV.ORIGIN },
  });
  check(response, { 'gradebook loads': (r) => r.status === 200 });
}
