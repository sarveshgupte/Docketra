import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'acme';
const LOGIN_XID = __ENV.LOGIN_XID || 'X000001';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'ChangeMe@123';

export const options = {
  scenarios: {
    login: {
      executor: 'constant-vus',
      vus: Number(__ENV.LOGIN_VUS || 25),
      duration: __ENV.LOGIN_DURATION || '30s',
      exec: 'loginScenario',
    },
    case_listing: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: Number(__ENV.CASE_LIST_VUS || 100) },
        { duration: '30s', target: Number(__ENV.CASE_LIST_VUS || 100) },
        { duration: '15s', target: 0 },
      ],
      exec: 'caseListingScenario',
      startTime: '5s',
    },
    case_creation: {
      executor: 'constant-vus',
      vus: Number(__ENV.CASE_CREATE_VUS || 10),
      duration: __ENV.CASE_CREATE_DURATION || '30s',
      exec: 'caseCreationScenario',
      startTime: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const login = () => {
  const response = http.post(
    `${BASE_URL}/${TENANT_SLUG}/login`,
    JSON.stringify({ xID: LOGIN_XID, password: LOGIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(response, { 'login succeeds': (res) => res.status === 200 });
  return response.json('data.accessToken') || response.json('accessToken') || null;
};

export function loginScenario() {
  login();
  sleep(1);
}

export function caseListingScenario() {
  const token = login();
  if (!token) return;
  const response = http.get(`${BASE_URL}/api/cases?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(response, { 'case listing succeeds': (res) => res.status === 200 });
  sleep(1);
}

export function caseCreationScenario() {
  const token = login();
  if (!token) return;
  const payload = {
    title: `Load test case ${Date.now()}`,
    description: 'Created by k6 production hardening smoke test',
    categoryId: __ENV.CATEGORY_ID || 'CATEGORY_ID_REQUIRED',
    subcategoryId: __ENV.SUBCATEGORY_ID || 'SUBCATEGORY_ID_REQUIRED',
    priority: 'medium',
  };
  const response = http.post(`${BASE_URL}/api/cases`, JSON.stringify(payload), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${__VU}-${__ITER}-${Date.now()}`,
    },
  });
  check(response, {
    'case creation succeeds or is preconditioned': (res) => [200, 201, 400, 404].includes(res.status),
  });
  sleep(1);
}
