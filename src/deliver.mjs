/** Send once to the local fixture. This is not a general-purpose HTTP client. */
export async function deliver(mapped, endpoint, { timeoutMs = 1000 } = {}) {
  const url = new URL(endpoint);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.pathname !== '/orders'
      || url.username || url.password || url.search || url.hash) {
    throw new Error('LOCAL_DEMO_ONLY');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new Error('INVALID_TIMEOUT');
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mapped),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error'
    });
    // No response payload is needed. Release the stream without trusting its text.
    await response.body?.cancel();
  } catch {
    throw new Error('DESTINATION_UNREACHABLE');
  }

  // No automatic retries: a failed response does not prove a POST wasn't applied.
  if (response.status !== 201) throw new Error(`DESTINATION_REJECTED_${response.status}`);
  return response.status;
}
