// Run against a local Cellula instance with no Supabase or AI credentials.
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:3000';
const get = path => fetch(new URL(path, base));
for (const [path, text] of [['/', 'the living world'], ['/explore/botany', 'Botany'], ['/videos', 'Video library'], ['/articles/the-monarchs-long-journey', 'A compass that keeps time'], ['/studio', 'Browser-only preview']]) {
  const page = await get(path);
  assert.equal(page.status, 200, path);
  assert.match(await page.text(), new RegExp(text), path);
}
let result = await get('/api/chat');
let cookie = result.headers.get('set-cookie').split(';')[0];
assert.deepEqual(await result.json(), { mode: 'practice', remaining: 2 });
const ask = () => fetch(new URL('/api/chat', base), { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'How do ferns unfurl?' }] }) });
for (const remaining of [1, 0]) {
  result = await ask();
  assert.equal(result.status, 200);
  cookie = result.headers.get('set-cookie').split(';')[0];
  const data = await result.json();
  assert.equal(data.remaining, remaining);
  assert.match(data.text, /circinate vernation/);
}
result = await ask();
assert.equal(result.status, 429);
assert.equal((await result.json()).code, 'guest');
console.log('Preview smoke tests passed: pages, article, Studio, and server-side guest cap.');
