import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ReplayLedger } from '../src/replay-ledger.mjs';

const input = JSON.parse(readFileSync(new URL('../fixtures/replay-input.json', import.meta.url), 'utf8'));
const expected = JSON.parse(readFileSync(new URL('../fixtures/replay-expected.json', import.meta.url), 'utf8'));
const worker = fileURLToPath(new URL('../fixtures/replay-worker.mjs', import.meta.url));
const summary = state => ({ events: state.events.length, deliveries: state.deliveries.length,
  fulfillments: state.fulfillments.length, state: state.events[0]?.state ?? null });
const report = { runtime: process.version, input, scenarios: [] };
const directory = mkdtempSync(join(tmpdir(), 'webhook-replay-lab-'));
try {
  for (const [phase, wanted] of Object.entries(expected)) {
    const path = join(directory, `${phase}.sqlite`);
    const operation = phase.includes('receipt') ? 'receive' : 'replay';
    if (operation === 'replay') {
      const initial = new ReplayLedger(path);
      try { initial.receive(input); } finally { initial.close(); }
    }
    const child = spawnSync(process.execPath, [worker, path, operation, phase], { encoding: 'utf8', timeout: 15000 });
    assert.equal(child.status, 86, child.stderr || child.error?.message);
    const recovered = new ReplayLedger(path);
    try {
      const beforeRecovery = summary(recovered.snapshot());
      recovered.receive(input);
      recovered.replay();
      recovered.receive(input);
      recovered.replay();
      const state = recovered.snapshot();
      const actual = { beforeRecovery, afterRecovery: summary(state) };
      assert.deepEqual(actual, wanted);
      report.scenarios.push({ phase, childExit: child.status, expected: wanted, actual, state, pass: true });
    } finally { recovered.close(); }
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
