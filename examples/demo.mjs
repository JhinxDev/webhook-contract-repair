import assert from 'node:assert/strict';
import { payload, brokenMap } from '../fixtures/payload.mjs';
import { mapOrder } from '../src/map-order.mjs';
import { deliver } from '../src/deliver.mjs';
import { startDestination } from '../fixtures/destination.mjs';

const destination = await startDestination();
try {
  console.log('Webhook contract repair | synthetic local demonstration');
  console.log('\nBEFORE: mapper reads the wrong JSON level.');
  console.log('Payload sent:', JSON.stringify(brokenMap(payload)));
  await assert.rejects(deliver(brokenMap(payload), destination.endpoint), /DESTINATION_REJECTED_422/);
  console.log('Observed result: HTTP 422, contract mismatch.');

  console.log('\nAFTER: mapper validates and converts the five allowed fields.');
  const output = mapOrder(payload);
  console.log(JSON.stringify(output, null, 2));
  assert.equal(await deliver(output, destination.endpoint), 201);
  assert.equal(destination.accepted.length, 1);
  console.log('Observed result: HTTP 201, one record accepted in this run.');
  console.log('\nNo client data, credentials, external API or n8n runtime involved.');
} finally {
  await destination.close();
}
