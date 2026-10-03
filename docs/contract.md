# Synthetic API contract

This is the agreed contract for the exercise, not a description of a third-party API.

## Input

The mapper accepts a parsed object containing `body.event_id` and `body.order`.

```json
{
  "body": {
    "event_id": "evt_demo_01",
    "order": {
      "id": "order_demo_01",
      "quantity": "2",
      "unit_price": "19.95",
      "currency": "CAD"
    }
  }
}
```

| Input | Rule | Output |
| --- | --- | --- |
| `body.event_id` | 1 to 64 ASCII letters, digits, underscores or hyphens | `eventId` |
| `body.order.id` | Same ID rule | `orderId` |
| `body.order.quantity` | Integer number or canonical positive integer string, 1 to 1000 | Integer `quantity` |
| `body.order.unit_price` | Decimal string with 1 to 6 whole digits and exactly two fractional digits | Integer `unitPriceCents`, 0 to 99,999,999 |
| `body.order.currency` | Literal `CAD` | `currency` |

Additional source fields are ignored. No additional destination fields are permitted. Object/array envelope confusion, fractional quantities and ambiguous prices fail validation. Commas, exponent notation, currency symbols and numerical floating-point prices are deliberately unsupported.

## Destination

`POST /orders`, `Content-Type: application/json`, on the temporary local fixture. An accepted record returns 201. Contract mismatch returns 422; malformed JSON returns 400; body larger than 4096 bytes returns 413. The fixture stores accepted records only in memory until shutdown.

The sender requires 201, rejects redirects and uses a bounded timeout. A failed POST is not retried because the HTTP destination does not implement replay-safe delivery. The separate [SQLite replay lab](replay-lab.md) demonstrates duplicate suppression and recovery for a local database effect only; it does not retry these HTTP requests.

## Errors

Mapping errors are `INVALID_ENVELOPE`, `INVALID_ID`, `INVALID_QUANTITY`, `INVALID_PRICE` and `UNSUPPORTED_CURRENCY`. Delivery rejects disallowed destinations with `LOCAL_DEMO_ONLY` and invalid timeout configuration with `INVALID_TIMEOUT`. Network/timeout/redirect failures produce `DESTINATION_UNREACHABLE`; unexpected HTTP status produces `DESTINATION_REJECTED_<status>`. Errors do not echo the submitted payload.
