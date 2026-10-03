import { DatabaseSync } from 'node:sqlite';
import { mapOrder } from './map-order.mjs';

/** Local synthetic order-create inbox. No network effects or Stripe authentication. */
export class ReplayLedger {
  #db;

  constructor(path) {
    this.#db = new DatabaseSync(path);
    try {
      this.#db.exec(`
        PRAGMA busy_timeout = 5000;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = FULL;
        CREATE TABLE IF NOT EXISTS events (
          event_id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'pending'
            CHECK (state IN ('pending', 'completed', 'rejected')),
          reason TEXT
        );
        CREATE TABLE IF NOT EXISTS deliveries (
          receipt INTEGER PRIMARY KEY,
          event_id TEXT NOT NULL REFERENCES events(event_id),
          outcome TEXT NOT NULL CHECK (outcome IN ('queued', 'duplicate', 'conflict'))
        );
        CREATE TABLE IF NOT EXISTS fulfillments (
          order_id TEXT PRIMARY KEY,
          quantity INTEGER NOT NULL,
          unit_price_cents INTEGER NOT NULL,
          currency TEXT NOT NULL,
          content TEXT NOT NULL
        );
      `);
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }

  #transaction(action) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.#db.exec('COMMIT');
      return result;
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  // Checkpoints are synchronous fault-injection seams, not external-effect callbacks.
  // A 202 is returned only after the inbox and receipt transaction commits.
  receive(input, checkpoint = () => {}) {
    const { eventId, ...order } = mapOrder(input);
    const content = JSON.stringify(order);
    const acknowledgement = this.#transaction(() => {
      const existing = this.#db.prepare('SELECT content, state FROM events WHERE event_id = ?').get(eventId);
      const conflict = existing && existing.content !== content;
      if (!existing) this.#db.prepare('INSERT INTO events(event_id, content) VALUES (?, ?)').run(eventId, content);
      this.#db.prepare('INSERT INTO deliveries(event_id, outcome) VALUES (?, ?)')
        .run(eventId, conflict ? 'conflict' : existing ? 'duplicate' : 'queued');
      checkpoint('before-receipt-commit');
      return conflict
        ? { status: 409, error: 'EVENT_CONTENT_CONFLICT' }
        : { status: 202, duplicate: Boolean(existing), state: existing?.state ?? 'pending' };
    });
    checkpoint('after-receipt-commit');
    return acknowledgement;
  }

  // A bounded drain: each iteration atomically selects pending work, applies the
  // local effect and marks completion. SQLite serializes competing writers.
  replay(checkpoint = () => {}, limit = 100) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('INVALID_REPLAY_LIMIT');
    const results = [];
    for (let i = 0; i < limit; i++) {
      const result = this.#transaction(() => {
        const event = this.#db.prepare("SELECT event_id, content FROM events WHERE state = 'pending' ORDER BY rowid LIMIT 1").get();
        if (!event) return null;
        const order = JSON.parse(event.content);
        const existing = this.#db.prepare('SELECT content FROM fulfillments WHERE order_id = ?').get(order.orderId);
        if (existing && existing.content !== event.content) {
          this.#db.prepare("UPDATE events SET state = 'rejected', reason = 'ORDER_CONTENT_CONFLICT' WHERE event_id = ?").run(event.event_id);
          return { eventId: event.event_id, state: 'rejected' };
        }
        if (!existing) {
          this.#db.prepare('INSERT INTO fulfillments VALUES (?, ?, ?, ?, ?)')
            .run(order.orderId, order.quantity, order.unitPriceCents, order.currency, event.content);
        }
        checkpoint('after-effect-write');
        this.#db.prepare("UPDATE events SET state = 'completed' WHERE event_id = ?").run(event.event_id);
        return { eventId: event.event_id, state: 'completed' };
      });
      if (!result) break;
      checkpoint('after-effect-commit');
      results.push(result);
    }
    return results;
  }

  snapshot() {
    // One transaction gives a coherent view even while another process works.
    return this.#transaction(() => ({
      events: this.#db.prepare('SELECT event_id AS eventId, state, reason FROM events ORDER BY event_id').all().map(row => ({ ...row })),
      deliveries: this.#db.prepare('SELECT receipt, event_id AS eventId, outcome FROM deliveries ORDER BY receipt').all().map(row => ({ ...row })),
      fulfillments: this.#db.prepare('SELECT order_id AS orderId, quantity, unit_price_cents AS unitPriceCents, currency FROM fulfillments ORDER BY order_id').all().map(row => ({ ...row }))
    }));
  }

  close() { this.#db.close(); }
}
