/** Fictional data, used only in tests and the local demo. */
export const payload = {
  body: {
    event_id: 'evt_demo_01',
    order: {
      id: 'order_demo_01', quantity: '2', unit_price: '19.95',
      currency: 'CAD', internal_note: 'Never send this field'
    },
    customer: { email: 'synthetic@example.invalid' }
  }
};

/** Seeded failure: wrong envelope path and absent type conversion. Not used by src/. */
export function brokenMap(input) {
  return {
    eventId: input.event_id,
    orderId: input.order?.id,
    quantity: input.order?.quantity,
    unitPriceCents: input.order?.unit_price,
    currency: input.order?.currency
  };
}
