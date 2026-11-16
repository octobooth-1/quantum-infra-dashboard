import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

export function createFrontendServer() {
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    const asset = assets.get(request.url.split('?')[0]);
    if (!asset) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    try {
      const content = await readFile(new URL(asset[0], import.meta.url));
      response.writeHead(200, {
        'Content-Type': asset[1],
        'Content-Length': content.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      console.error(`Failed to serve ${asset[0]}:`, error);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Unable to load frontend asset');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createFrontendServer();
  server.on('error', (error) => {
    console.error(`Frontend server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(3000, 'localhost', () => {
    console.log('Quantum dashboard frontend: http://localhost:3000');
    console.log('Metrics API: http://localhost:3001/api/metrics');
  });
}
