import test from 'node:test';
import assert from 'node:assert/strict';
import { extractive, planner, writer } from './agents.js';

test('extractive summary keeps relevant sentences', () => {
  const text = 'Cats sleep a lot. Solar panels convert sunlight into electricity. Dogs bark loudly. Solar energy is growing fast.';
  const s = extractive(text, 'solar energy', 2);
  assert.match(s, /Solar/);
  assert.doesNotMatch(s, /Dogs/);
});

test('offline planner returns several queries', async () => {
  delete process.env.OPENAI_API_KEY;
  assert.ok((await planner('quantum computing')).length >= 3);
});

test('writer builds markdown with sources', async () => {
  delete process.env.OPENAI_API_KEY;
  const md = await writer('Topic', [{ query: 'q', summary: 'sum', sources: [{ title: 'T', url: 'https://x.org' }] }]);
  assert.match(md, /# Topic/);
  assert.match(md, /\[T\]\(https:\/\/x.org\)/);
});
