import test from 'node:test';
import assert from 'node:assert/strict';
import { payload as example, brokenMap } from '../fixtures/payload.mjs';
import { mapOrder as repairMap } from '../src/map-order.mjs';
import { deliver } from '../src/deliver.mjs';
import { validDestination } from '../fixtures/destination.mjs';
import { startDestination } from '../fixtures/destination.mjs';

test('seeded mapper fails the independently specified destination contract', () => {
  assert.equal(validDestination(brokenMap(example)), false);
});
test('repaired mapping matches exact expected fields and types', () => {
  assert.deepEqual(repairMap(example), { eventId: 'evt_demo_01', orderId: 'order_demo_01', quantity: 2, unitPriceCents: 1995, currency: 'CAD' });
});
test('exact cents for 0.29 and zero without floating-point truncation', () => {
  for (const [price, cents] of [['0.29', 29], ['0.00', 0], ['999999.99', 99999999]]) {
    const input = structuredClone(example); input.body.order.unit_price = price;
    assert.equal(repairMap(input).unitPriceCents, cents);
  }
});
test('rejects missing envelope or IDs', () => {
  for (const value of [null, {}, { body: {} }]) assert.throws(() => repairMap(value), /INVALID_ENVELOPE/);
  const input = structuredClone(example); delete input.body.event_id;
  assert.throws(() => repairMap(input), /INVALID_ID/);
});
test('rejects fractional, oversized, negative and malformed quantities', () => {
  for (const value of ['2x', '1.5', '', 0, -1, 1001, null, true]) {
    const input = structuredClone(example); input.body.order.quantity = value;
    assert.throws(() => repairMap(input), /INVALID_QUANTITY/);
  }
});
test('rejects ambiguous price formats rather than guessing', () => {
  for (const value of ['19,95', '$19.95', '1.999', '-1.00', '1e2', 19.95, null]) {
    const input = structuredClone(example); input.body.order.unit_price = value;
    assert.throws(() => repairMap(input), /INVALID_PRICE/);
  }
});
test('rejects unsupported currency', () => {
  const input = structuredClone(example); input.body.order.currency = 'USD';
  assert.throws(() => repairMap(input), /UNSUPPORTED_CURRENCY/);
});
test('omits personal and internal fields and leaves source unchanged', () => {
  const input = structuredClone(example); const before = JSON.stringify(input);
  const output = repairMap(input);
  assert.doesNotMatch(JSON.stringify(output), /email|internal_note|synthetic@/);
  assert.equal(JSON.stringify(input), before);
});
test('real HTTP: broken output rejected, repaired output accepted in a single test call', async t => {
  const destination = await startDestination(); t.after(destination.close);
  await assert.rejects(deliver(brokenMap(example), destination.endpoint), /DESTINATION_REJECTED_422/);
  assert.equal(destination.accepted.length, 0);
  assert.equal(await deliver(repairMap(example), destination.endpoint), 201);
  assert.deepEqual(destination.accepted, [repairMap(example)]);
});
test('refuses external destination URLs', async () => {
  await assert.rejects(deliver(repairMap(example), 'https://example.invalid/orders'), /LOCAL_DEMO_ONLY/);
});
