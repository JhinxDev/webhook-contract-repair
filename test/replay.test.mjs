import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ReplayLedger } from '../src/replay-ledger.mjs';
import { payload } from '../fixtures/payload.mjs';

const worker = fileURLToPath(new URL('../fixtures/replay-worker.mjs', import.meta.url));
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'webhook-replay-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'ledger.sqlite');
}
function use(path, fn) {
  const db = new ReplayLedger(path);
  try { return fn(db); } finally { db.close(); }
}
function crash(path, operation, phase) {
  const child = spawnSync(process.execPath, [worker, path, operation, phase], { encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 86, child.stderr);
}

test('receipt acknowledges durable queueing, not completion; duplicates have one effect', t => {
  const path = setup(t);
  use(path, db => {
    assert.deepEqual(db.receive(payload), { status: 202, duplicate: false, state: 'pending' });
    assert.equal(db.snapshot().fulfillments.length, 0);
    assert.equal(db.receive(payload).duplicate, true);
  });
  use(path, db => {
    db.replay();
    assert.deepEqual(db.receive(payload), { status: 202, duplicate: true, state: 'completed' });
    db.replay();
    assert.equal(db.snapshot().deliveries.length, 3);
    assert.equal(db.snapshot().fulfillments.length, 1);
  });
});

for (const phase of ['before-receipt-commit', 'after-receipt-commit']) {
  test(`restart after ${phase} can safely receive and replay`, t => {
    const path = setup(t);
    crash(path, 'receive', phase);
    use(path, db => {
      assert.equal(db.snapshot().events.length, phase === 'before-receipt-commit' ? 0 : 1);
      db.receive(payload);
      db.replay();
      assert.equal(db.snapshot().fulfillments.length, 1);
      assert.equal(db.snapshot().events[0].state, 'completed');
    });
  });
}
for (const phase of ['after-effect-write', 'after-effect-commit']) {
  test(`restart after ${phase} preserves atomic effect and completion`, t => {
    const path = setup(t);
    use(path, db => db.receive(payload));
    crash(path, 'replay', phase);
    use(path, db => {
      const committed = phase === 'after-effect-commit';
      assert.equal(db.snapshot().fulfillments.length, committed ? 1 : 0);
      assert.equal(db.snapshot().events[0].state, committed ? 'completed' : 'pending');
      db.replay();
      db.receive(payload);
      db.replay();
      assert.equal(db.snapshot().fulfillments.length, 1);
    });
  });
}

test('concurrent processes receiving and replaying produce one fulfillment', { timeout: 15000 }, async t => {
  const path = setup(t);
  use(path, () => {});
  async function race(operation) {
    const children = Array.from({ length: 4 }, () => fork(worker, [path, operation], { silent: true }));
    t.after(() => children.forEach(child => { if (child.exitCode === null) child.kill(); }));
    const completions = children.map(child => new Promise((resolve, reject) => {
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr || `exit ${code}`)));
    }));
    await Promise.all(children.map(child => new Promise((resolve, reject) => {
      child.once('message', resolve);
      child.once('error', reject);
      child.once('exit', () => reject(new Error('exited before ready')));
    })));
    children.forEach(child => child.send('go'));
    await Promise.all(completions);
  }
  await race('receive');
  await race('replay');
  use(path, db => {
    assert.equal(db.snapshot().deliveries.length, 4);
    assert.equal(db.snapshot().events.length, 1);
    assert.equal(db.snapshot().fulfillments.length, 1);
  });
});

test('reused event ID with changed mapped content is rejected and recorded', t => {
  use(setup(t), db => {
    db.receive(payload);
    const changed = structuredClone(payload);
    changed.body.order.quantity = '3';
    assert.equal(db.receive(changed).status, 409);
    db.replay();
    const state = db.snapshot();
    assert.equal(state.fulfillments[0].quantity, 2);
    assert.equal(state.deliveries[1].outcome, 'conflict');
  });
});

test('different event IDs for the same order deduplicate; conflicting order is quarantined', t => {
  use(setup(t), db => {
    db.receive(payload);
    for (const [id, quantity] of [['evt_second', '2'], ['evt_conflict', '3']]) {
      const next = structuredClone(payload);
      next.body.event_id = id;
      next.body.order.quantity = quantity;
      db.receive(next);
    }
    db.replay();
    const state = db.snapshot();
    assert.equal(state.fulfillments.length, 1);
    assert.equal(state.events.filter(event => event.state === 'completed').length, 2);
    assert.equal(state.events.filter(event => event.state === 'rejected').length, 1);
    assert.equal(db.replay().length, 0);
  });
});

test('independent create events delivered out of order converge', t => {
  const a = setup(t), b = setup(t);
  const second = structuredClone(payload);
  second.body.event_id = 'evt_other';
  second.body.order.id = 'order_other';
  const states = [[a, [payload, second]], [b, [second, payload]]].map(([path, inputs]) =>
    use(path, db => {
      inputs.forEach(input => db.receive(input));
      db.replay();
      return db.snapshot().fulfillments;
    }));
  assert.deepEqual(states[0], states[1]);
});

test('invalid input creates no receipt and transaction failure leaves work replayable', t => {
  use(setup(t), db => {
    assert.throws(() => db.receive({}), /INVALID_ENVELOPE/);
    assert.equal(db.snapshot().deliveries.length, 0);
    db.receive(payload);
    assert.throws(() => db.replay(phase => {
      if (phase === 'after-effect-write') throw new Error('synthetic worker failure');
    }), /synthetic worker failure/);
    assert.equal(db.snapshot().fulfillments.length, 0);
    assert.equal(db.snapshot().events[0].state, 'pending');
    db.replay();
    assert.equal(db.snapshot().fulfillments.length, 1);
  });
});

test('receipt write failure returns no acknowledgement or partial ledger entry', t => {
  use(setup(t), db => {
    assert.throws(() => db.receive(payload, phase => {
      if (phase === 'before-receipt-commit') throw new Error('synthetic storage failure');
    }), /synthetic storage failure/);
    assert.deepEqual(db.snapshot(), { events: [], deliveries: [], fulfillments: [] });
    assert.equal(db.receive(payload).status, 202);
  });
});

test('replay limit is bounded and leaves the remainder pending', t => {
  use(setup(t), db => {
    for (let i = 0; i < 3; i++) {
      const next = structuredClone(payload);
      next.body.event_id = `evt_${i}`;
      next.body.order.id = `order_${i}`;
      db.receive(next);
    }
    assert.throws(() => db.replay(undefined, 0), /INVALID_REPLAY_LIMIT/);
    assert.equal(db.replay(undefined, 2).length, 2);
    assert.equal(db.snapshot().events.filter(event => event.state === 'pending').length, 1);
    assert.equal(db.replay().length, 1);
  });
});
