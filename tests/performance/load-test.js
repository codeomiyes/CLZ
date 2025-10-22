/**
 * Performance Test: Load Testing with k6
 * Test Case ID: PERF-001
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const workspaceLoadTime = new Trend('workspace_load_time');
const aiResponseTime = new Trend('ai_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 500 },   // Ramp up to 500 users
    { duration: '10m', target: 1000 }, // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '5m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
    errors: ['rate<0.005'],            // Custom error rate under 0.5%
    workspace_load_time: ['p(95)<3000'],
    ai_response_time: ['p(95)<5000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const users = [
  { email: 'user1@clorizon.com', password: 'Pass123!' },
  { email: 'user2@clorizon.com', password: 'Pass123!' },
  { email: 'user3@clorizon.com', password: 'Pass123!' },
];

export function setup() {
  console.log('Starting load test...');
  console.log(`Target URL: ${BASE_URL}`);
  return { startTime: new Date() };
}

export default function (data) {
  // Select random user
  const user = users[Math.floor(Math.random() * users.length)];

  // 1. Login
  let loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'auth token received': (r) => r.json('token') !== undefined,
  }) || errorRate.add(1);

  if (loginRes.status !== 200) {
    return;
  }

  const authToken = loginRes.json('token');
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  sleep(1);

  // 2. Load workspace
  const workspaceStart = Date.now();
  let workspaceRes = http.get(`${BASE_URL}/api/workspaces`, { headers });
  workspaceLoadTime.add(Date.now() - workspaceStart);

  check(workspaceRes, {
    'workspace loaded': (r) => r.status === 200,
    'workspace data valid': (r) => Array.isArray(r.json('workspaces')),
  }) || errorRate.add(1);

  sleep(2);

  // 3. Create workspace (20% of users)
  if (Math.random() < 0.2) {
    let createRes = http.post(`${BASE_URL}/api/workspaces`, JSON.stringify({
      name: `Workspace ${Date.now()}`,
      modules: ['ai-assistant', 'collaboration-engine'],
    }), { headers });

    check(createRes, {
      'workspace created': (r) => r.status === 201,
    }) || errorRate.add(1);

    sleep(1);
  }

  // 4. AI Assistant query (30% of users)
  if (Math.random() < 0.3) {
    const aiStart = Date.now();
    let aiRes = http.post(`${BASE_URL}/api/ai/query`, JSON.stringify({
      query: 'Summarize my recent activity',
      context: 'workspace_context',
    }), { headers });
    aiResponseTime.add(Date.now() - aiStart);

    check(aiRes, {
      'AI response received': (r) => r.status === 200,
      'AI response time acceptable': (r) => r.timings.duration < 5000,
    }) || errorRate.add(1);

    sleep(2);
  }

  // 5. Collaboration sync (40% of users)
  if (Math.random() < 0.4) {
    let syncRes = http.post(`${BASE_URL}/api/collaboration/sync`, JSON.stringify({
      documentId: 'doc_123',
      changes: [{ position: 10, insert: 'test' }],
    }), { headers });

    check(syncRes, {
      'sync successful': (r) => r.status === 200,
      'sync fast': (r) => r.timings.duration < 200,
    }) || errorRate.add(1);
  }

  sleep(3);
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
}
