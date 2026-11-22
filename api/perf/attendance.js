import http from 'k6/http';
import { check } from 'k6';

/** Every class saving attendance in the first minutes of a period. */
export const options = {
  scenarios: { periodStart: { executor: 'ramping-arrival-rate', startRate: 5, timeUnit: '1s', preAllocatedVUs: 100, stages: [{ target: 60, duration: '1m' }, { target: 0, duration: '30s' }] } },
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  const date = new Date().toISOString().slice(0, 10);
  const response = http.put(
    `${__ENV.BASE_URL}/api/v1/attendance/classes/${__ENV.CLASS_ID}`,
    JSON.stringify({ date, records: [] }),
    { headers: { cookie: __ENV.COOKIE, origin: __ENV.ORIGIN, 'content-type': 'application/json' } },
  );
  check(response, { 'attendance saves': (r) => r.status === 200 });
}
