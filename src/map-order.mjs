/**
 * Map a parsed synthetic webhook to the order API's five-field contract.
 * Throws stable error codes without including the caller's payload.
 * Money is a decimal string at the source and integer cents at the destination.
 * @param {unknown} input
 * @returns {{ eventId: string, orderId: string, quantity: number, unitPriceCents: number, currency: 'CAD' }}
 */
export function mapOrder(input) {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isRecord(input) || !isRecord(input.body) || !isRecord(input.body.order)) {
    throw new Error('INVALID_ENVELOPE');
  }

  const { body } = input;
  const { order } = body;
  for (const value of [body.event_id, order.id]) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
      throw new Error('INVALID_ID');
    }
  }

  const rawQuantity = order.quantity;
  const isIntegerString = typeof rawQuantity === 'string' && /^[1-9]\d*$/.test(rawQuantity);
  if (!(typeof rawQuantity === 'number' || isIntegerString)) {
    throw new Error('INVALID_QUANTITY');
  }
  const quantity = Number(rawQuantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
    throw new Error('INVALID_QUANTITY');
  }

  // Parse whole and fractional digits separately. Multiplying a floating-point
  // price by 100 can introduce rounding errors, particularly before truncation.
  if (typeof order.unit_price !== 'string' || !/^\d{1,6}\.\d{2}$/.test(order.unit_price)) {
    throw new Error('INVALID_PRICE');
  }
  const [whole, fraction] = order.unit_price.split('.');
  const unitPriceCents = Number(whole) * 100 + Number(fraction);

  if (order.currency !== 'CAD') throw new Error('UNSUPPORTED_CURRENCY');

  // Build an allowlisted object. Customer and internal fields cannot leak by spread.
  return {
    eventId: body.event_id,
    orderId: order.id,
    quantity,
    unitPriceCents,
    currency: order.currency
  };
}
