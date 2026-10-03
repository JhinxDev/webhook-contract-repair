# Durable local failure and replay lab

This lab is a synthetic, AI-assisted reliability exercise. It is not a Stripe receiver or a production payment integration. It adds no dependencies and does not replace the original HTTP mapping demo.

## Reproduce

Use Node 24.15.0 or newer in the Node 24 line (the verified runtime), npm, a writable local filesystem and child-process permission. The original transport tests additionally require loopback networking. The lab itself makes no network calls. Node's built-in `node:sqlite` API supplies SQLite; no database server is installed.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run demo
npm run lab
```

For a JSON-only expected/actual receipt:

```sh
node examples/replay-lab.mjs > replay-lab-actual.json
```

The lab creates fresh temporary databases, exits child processes with code 86 at four precise checkpoints, reopens each database and asserts the expected recovery state. It prints fixture input, expected counts, actual counts and full final ledger state. It removes only its own temporary directory. `fixtures/replay-input.json` and `fixtures/replay-expected.json` are the fixed inputs and expected states. No timing sleeps determine correctness.

## Contract and acknowledgement

This is a parsed-input library, not a new HTTP endpoint. `receive(input)` returns an object with HTTP-style status semantics for the lab. It validates through the existing mapper and stores only the normalized order fields. Personal and internal fields are excluded.

- `202`: event plus delivery receipt committed. Work may still be pending; this never means fulfillment succeeded. Duplicate receipts are durably counted. Completed or rejected events remain terminal even when redelivered.
- `409`: an existing event ID was reused with different normalized content. The conflict receipt commits, while the original event stays unchanged.
- Validation or SQLite errors throw without an acknowledgement. A future HTTP adapter must convert storage failure into a non-2xx response, not acknowledge failed persistence. No such adapter is implemented here.

After acknowledgement, `replay()` processes at most 100 pending events by default (configurable from 1 to 1000). The caller must keep draining until empty; no scheduler or backoff daemon is installed. A rejected order conflict is visible in the event ledger and is not retried automatically.

## What is atomic

Each write transaction begins with `BEGIN IMMEDIATE`. SQLite serializes competing writers with a five-second busy timeout. `synchronous=FULL` is set; the default rollback journal is retained. The event's completed state and the synthetic fulfillment insert commit in the **same database transaction**. A fulfillment is a local row, not a shipping instruction or remote API call.

The unique event ID suppresses delivery duplicates. A unique order ID additionally suppresses separate create-event IDs with identical normalized order content. Conflicting content for an already fulfilled order is quarantined as `rejected` with `ORDER_CONTENT_CONFLICT`. This is a single-tenant, one-time order-create policy; updates, refunds and multi-step order lifecycles are unsupported. Independent create events converge when received in reverse order. Conflicting creates for one order use first-committed content and intentionally do not promise order-independent resolution.

| Process exit checkpoint | State after reopen | Recovery |
| --- | --- | --- |
| Before inbox commit | No event or receipt | Redelivery creates pending work |
| After inbox commit, before acknowledgement returns | Pending event and receipt | Duplicate redelivery is safe; replay completes |
| After fulfillment write, before transaction commit | Pending event, no fulfillment | SQLite rolls back partial work; replay completes |
| After effect/completion commit, before worker returns | Completed event and one fulfillment | Replay finds no pending work; redelivery adds no effect |

Tests also synchronize four receiver child processes and then four worker child processes at a ready/go barrier. All use independent SQLite connections to the same file. Assertions require four durable delivery receipts, one event and one fulfillment. Injected exceptions verify rollback; malformed input, conflicting content and bounded draining have separate assertions.

## Remaining failure windows and operating limits

1. The one-effect claim applies only to this SQLite row under tested process-exit/concurrency cases. Sending email, charging a card or calling an HTTP API outside this transaction reintroduces the commit/response ambiguity. Those require a receiver idempotency key or an outbox plus an idempotent destination; this lab does neither.
2. Process termination is tested, not power loss, disk corruption, filesystem dishonesty, disk-full exhaustion or network filesystems. Database files and journals must stay together on a reliable local filesystem. Backup/restore and migrations are not implemented.
3. Busy timeout, permission or storage failure produces no success acknowledgement. A real receiver would need bounded retry policy, monitoring and capacity controls. SQLite's synchronous API blocks this process while executing; this is not a throughput design.
4. An accepted event can remain pending indefinitely if nobody runs replay. Rejected conflicts require explicit investigation; there is no repair UI. A 202 is a receipt, not a business outcome.
5. There is no authentication, signature verification, provider schema adapter, raw HTTP body validation, tenant isolation, retention policy or public ingress. Do not expose it as a service or feed real customer data into it.
6. Event-ID comparison uses normalized mapped content, not raw-byte identity. Ignored personal fields do not affect deduplication. The order-level key is a domain policy for this fixture, not a universal provider rule.

## Official semantics consulted

[Stripe webhook documentation](https://docs.stripe.com/webhooks), checked October 3, 2026, documents duplicate delivery, retries, unordered events and asynchronous handling. Those motivate the synthetic inbox/replay cases. This sample does not use Stripe event schemas, authenticate Stripe requests or verify a live Stripe integration. It does not infer event ordering from timestamps.

[Node SQLite documentation](https://nodejs.org/api/sqlite.html) describes the built-in synchronous database API. Actual API compatibility was tested with Node 24.15.0. Runtime/SQLite upgrades still need the same test suite.
