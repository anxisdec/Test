export function sameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    return [new URL(request.url).host, request.headers.get('host'), request.headers.get('x-forwarded-host')].includes(parsed.host);
  } catch { return false; }
}

export async function readJson(request: Request | Response, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Expected JSON.');
  if (Number(request.headers.get('content-length')) > limit) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request is empty.');
  const text = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let value = '';
  try {
    for (;;) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > limit) throw new Error('Request is too large.');
      value += text.decode(chunk, { stream: true });
    }
    return JSON.parse(value + text.decode());
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
