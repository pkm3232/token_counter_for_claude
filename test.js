const assert = require('assert');
const { parseSession, encode } = require('./extension');

const u = { input_tokens: 2, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 50 };
const lines = [
  JSON.stringify({ type: 'user', cwd: 'C:\\Work\\App', message: { content: 'hi' } }),
  JSON.stringify({ message: { id: 'a', usage: u } }),
  JSON.stringify({ message: { id: 'a', usage: u } }), // same message, second content block
  JSON.stringify({ message: { id: 'b', usage: { output_tokens: 5 } } }),
  JSON.stringify({ type: 'ai-title', aiTitle: 'Auto title' }),
  JSON.stringify({ type: 'custom-title', customTitle: 'My rename' }),
  'not json "usage"',
].join('\n');

const s = parseSession(lines);
assert.deepStrictEqual(s.totals, { input: 2, output: 15, cacheRead: 100, cacheWrite: 50, total: 167 });
assert.strictEqual(s.title, 'My rename'); // a rename beats the AI title
assert.strictEqual(s.cwd, 'C:\\Work\\App');
assert.strictEqual(parseSession(JSON.stringify({ aiTitle: 'Auto' })).title, 'Auto');
assert.strictEqual(encode('C:\\WorkSpace\\Personal'), 'c--workspace-personal');
console.log('ok');
