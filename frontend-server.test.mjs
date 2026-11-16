import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrontendServer } from './frontend-server.mjs';

test('frontend serves only public assets and supports HEAD', async (t) => {
  const server = createFrontendServer();
  await new Promise((resolve) => server.listen(0, 'localhost', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://localhost:${server.address().port}`;
  for (const [path, contentType, content] of [
    ['/', 'text/html', 'SYNTHETIC DATA'],
    ['/styles.css', 'text/css', '@media'],
    ['/app.js', 'text/javascript', 'http://localhost:3001/api/metrics'],
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(contentType));
    assert.ok((await response.text()).includes(content));
  }
  const head = await fetch(`${base}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/frontend-server.mjs', '/config.json', '/%2e%2e/config.json', '/api/metrics']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
  const post = await fetch(base, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});
