import test from 'node:test';
import assert from 'node:assert/strict';
import { mapOrder } from '../src/map-order.mjs';
import { deliver } from '../src/deliver.mjs';
import { payload } from '../fixtures/payload.mjs';
import { startDestination } from '../fixtures/destination.mjs';

test('rejects arrays and non-record envelopes', () => {
  for (const input of [[], { body: [] }, { body: { order: [] } }, 'text', 1]) {
    assert.throws(() => mapOrder(input), /INVALID_ENVELOPE/);
  }
});

test('quantity number and string have the same mapping; IDs are bounded', () => {
  const input = structuredClone(payload);
  input.body.order.quantity = 2;
  assert.deepEqual(mapOrder(input), mapOrder(payload));
  for (const id of ['', 'x'.repeat(65), '../orders', 123]) {
    input.body.event_id = id;
    assert.throws(() => mapOrder(input), /INVALID_ID/);
  }
});

test('fixture rejects wrong method, malformed JSON, extra fields and oversized body', async t => {
  const destination = await startDestination();
  t.after(destination.close);
  assert.equal((await fetch(destination.endpoint)).status, 404);
  for (const [body, expected] of [
    ['{', 400],
    [JSON.stringify({ ...mapOrder(payload), email: 'synthetic@example.invalid' }), 422],
    ['x'.repeat(4097), 413]
  ]) {
    const response = await fetch(destination.endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body
    });
    assert.equal(response.status, expected);
    await response.body?.cancel();
  }
  assert.equal(destination.accepted.length, 0);
});

test('503 failure is visible and never automatically retried', async t => {
  const destination = await startDestination({ mode: 'unavailable' });
  t.after(destination.close);
  await assert.rejects(deliver(mapOrder(payload), destination.endpoint), /DESTINATION_REJECTED_503/);
  assert.equal(destination.requests, 1);
});

test('client timeout terminates the request without retrying', async t => {
  const destination = await startDestination({ mode: 'timeout' });
  t.after(destination.close);
  await assert.rejects(deliver(mapOrder(payload), destination.endpoint, { timeoutMs: 100 }), /DESTINATION_UNREACHABLE/);
  assert.equal(destination.requests, 1);
});

test('redirects are rejected rather than followed', async t => {
  const destination = await startDestination({ mode: 'redirect' });
  t.after(destination.close);
  await assert.rejects(deliver(mapOrder(payload), destination.endpoint), /DESTINATION_UNREACHABLE/);
  assert.equal(destination.requests, 1);
});

test('URL credentials, query strings and invalid timeouts fail before transport', async () => {
  for (const url of ['http://user:pass@127.0.0.1/orders', 'http://127.0.0.1/orders?q=x', 'http://127.0.0.1/orders#x']) {
    await assert.rejects(deliver(mapOrder(payload), url), /LOCAL_DEMO_ONLY/);
  }
  await assert.rejects(deliver(mapOrder(payload), 'http://127.0.0.1/orders', { timeoutMs: 0 }), /INVALID_TIMEOUT/);
});
