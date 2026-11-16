import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApiServer, generateMetrics } from './server.mjs';

const server = createApiServer();
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
});

test('health explicitly identifies the synthetic, disconnected demo', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const health = await response.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.source, 'synthetic');
  assert.equal(health.hardwareConnected, false);
  assert.ok(Number.isFinite(Date.parse(health.timestamp)));
});

test('metrics preserve the frontend contract and match the newest chart point', async () => {
  const response = await fetch(`${baseUrl}/api/metrics`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-telemetry-source'), 'synthetic');
  const metrics = await response.json();
  assert.deepEqual(Object.keys(metrics), ['generatedAt', 'summary', 'series']);
  assert.deepEqual(Object.keys(metrics.summary), [
    'deviceStatus', 'fidelity', 'errorRate', 'calibrationDrift', 'jobsRunning',
  ]);
  assert.match(metrics.summary.deviceStatus, /demo/i);
  assert.ok(Number.isInteger(metrics.summary.jobsRunning));
  assert.equal(metrics.series.length, 24);
  for (const [index, point] of metrics.series.entries()) {
    assert.deepEqual(Object.keys(point), ['time', 'fidelity', 'errorRate', 'drift']);
    assert.ok(point.fidelity > 99 && point.fidelity < 100);
    assert.ok(point.errorRate > 0 && point.errorRate < 1);
    assert.ok(point.drift > 0 && point.drift < 1);
    assert.equal(Date.parse(point.time), Date.parse(metrics.generatedAt) - (23 - index) * 60_000);
  }
  const latest = metrics.series.at(-1);
  assert.equal(metrics.summary.fidelity, latest.fidelity);
  assert.equal(metrics.summary.errorRate, latest.errorRate);
  assert.equal(metrics.summary.calibrationDrift, latest.drift);
});

test('synthetic telemetry evolves with time', () => {
  const first = generateMetrics(new Date('2026-11-17T00:00:00Z'));
  const next = generateMetrics(new Date('2026-11-17T00:01:00Z'));
  assert.notDeepEqual(first.summary, next.summary);
  assert.deepEqual(first.series.slice(1), next.series.slice(0, -1));
});

test('CORS permits the localhost frontend and preflight requests', async () => {
  for (const method of ['GET', 'OPTIONS']) {
    const response = await fetch(`${baseUrl}/api/metrics`, {
      method,
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 200);
    if (method === 'OPTIONS') assert.equal(await response.text(), '');
    else await response.json();
  }
});

test('unknown paths and unsupported methods return JSON errors', async () => {
  const missing = await fetch(`${baseUrl}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found' });
  const unsupported = await fetch(`${baseUrl}/api/metrics`, { method: 'POST' });
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('allow'), 'GET, OPTIONS');
  assert.deepEqual(await unsupported.json(), { error: 'Method not allowed' });
});
