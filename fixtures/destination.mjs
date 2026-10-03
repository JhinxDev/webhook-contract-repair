import { createServer } from 'node:http';

/** Independent destination validator: intentionally does not import mapOrder. */
export function validDestination(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = ['eventId', 'orderId', 'quantity', 'unitPriceCents', 'currency'];
  return Object.keys(body).length === keys.length
    && keys.every(key => Object.hasOwn(body, key))
    && [body.eventId, body.orderId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value))
    && Number.isInteger(body.quantity) && body.quantity >= 1 && body.quantity <= 1000
    && Number.isInteger(body.unitPriceCents) && body.unitPriceCents >= 0 && body.unitPriceCents <= 99_999_999
    && body.currency === 'CAD';
}

/** Loopback-only API fixture. Fault modes exist only to test the client. */
export async function startDestination({ mode = 'ok' } = {}) {
  const accepted = [];
  let requests = 0;
  const server = createServer(async (req, res) => {
    requests++;
    const finish = (status, text) => {
      res.writeHead(status, { 'content-type': 'text/plain' });
      res.end(text);
    };
    if (req.method !== 'POST' || req.url !== '/orders') return finish(404, 'not found');
    if (req.headers['content-type'] !== 'application/json') return finish(415, 'JSON required');
    if (mode === 'timeout') return;
    if (mode === 'unavailable') return finish(503, 'unavailable');
    if (mode === 'redirect') {
      res.writeHead(302, { location: '/elsewhere' });
      return res.end();
    }

    const chunks = [];
    let bytes = 0;
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4096) return finish(413, 'too large');
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!validDestination(body)) return finish(422, 'contract mismatch');
      accepted.push(body);
      return finish(201, 'accepted');
    } catch {
      return finish(400, 'invalid JSON');
    }
  });
  server.requestTimeout = 2000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    endpoint: `http://127.0.0.1:${server.address().port}/orders`,
    accepted,
    get requests() { return requests; },
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  };
}
