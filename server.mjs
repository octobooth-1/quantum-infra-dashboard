import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const round = (value) => Number(value.toFixed(3));

export function generateMetrics(now = new Date()) {
  const series = Array.from({ length: 24 }, (_, index) => {
    const timestamp = now.getTime() - (23 - index) * 60_000;
    const phase = timestamp / 240_000;
    return {
      time: new Date(timestamp).toISOString(),
      fidelity: round(99.25 + 0.22 * Math.sin(phase)),
      errorRate: round(0.58 + 0.13 * Math.cos(phase * 0.8)),
      drift: round(0.21 + 0.09 * Math.sin(phase * 0.6)),
    };
  });
  const latest = series.at(-1);
  return {
    generatedAt: now.toISOString(),
    summary: {
      deviceStatus: 'Demo / operational',
      fidelity: latest.fidelity,
      errorRate: latest.errorRate,
      calibrationDrift: latest.drift,
      jobsRunning: 6 + Math.floor((1 + Math.sin(now.getTime() / 120_000)) * 3),
    },
    series,
  };
}

export function createApiServer() {
  return createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Telemetry-Source', 'synthetic');

    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };

    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname !== '/api/health' && pathname !== '/api/metrics') {
        json(404, { error: 'Not found' });
      } else if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
      } else if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET, OPTIONS');
        json(405, { error: 'Method not allowed' });
      } else if (pathname === '/api/health') {
        json(200, {
          status: 'ok',
          source: 'synthetic',
          hardwareConnected: false,
          timestamp: new Date().toISOString(),
        });
      } else {
        json(200, generateMetrics());
      }
    } catch (error) {
      console.error('Quantum dashboard API request failed:', error);
      json(500, { error: 'Internal server error' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createApiServer();
    server.on('error', (error) => {
      console.error('Quantum dashboard API failed to start:', error.message);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Quantum dashboard API: http://localhost:${port}`);
      console.log('Synthetic demo telemetry only. No quantum hardware is connected.');
    });
  }
}
