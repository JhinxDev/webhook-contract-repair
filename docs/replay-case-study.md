# Duplicate delivery and restart recovery

**Problem:** A valid webhook mapping still leaves a reliability question: what happens when delivery repeats or a worker exits at the wrong moment?

**Approach:** I extended my synthetic webhook repair example with a durable SQLite inbox, recorded delivery attempts and a separate replay step. The intended effect is deliberately small: one local fulfillment row. That row and event completion share a transaction. Event IDs suppress duplicate deliveries, while an order key handles equivalent create events with different IDs. Conflicting order content is recorded for investigation.

**Evidence:** The local suite has 29 passing tests, including four process-exit checkpoints, synchronized concurrent processes, duplicate delivery, malformed inputs, conflicts and reverse delivery order for independent creates. A standalone command emits fixture inputs and expected/actual recovery state. The original HTTP mapping demo still reproduces its 422 failure and 201 repair.

**Limits:** This proves the tested local database behavior. It does not establish exactly-once external API effects, production Stripe readiness, real-client experience or a security certification. There are no customer records or real payment calls. Storage failure, provider authentication and operational rollout require separate work.

**Authorship:** This is a personal synthetic portfolio project developed with AI assistance. Owner review and understanding are separate from automated test success.

Version 0.2.0 extends the original mapping example. The v0.1.0 package remains available unchanged.
