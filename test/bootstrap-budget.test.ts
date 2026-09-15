import test from 'node:test';
import assert from 'node:assert/strict';
import { auditBootstrap, contextSlots, evaluateSyntheticBootstrap } from '../scripts/evaluate-bootstrap.js';

const empty = () => Object.fromEntries(contextSlots.map(key => [key, '']));

test('bootstrap audit counts UTF-8 occurrences and its own receipt, without deduplicating loaded context', () => {
  const context = { ...empty(), user: 'Ω', conversation: 'Ω' }, result = auditBootstrap('Ω', context);
  assert.equal(result.knownBytesIncludingReceipt, 6 + Buffer.byteLength(result.receipt));
  assert.equal(result.allowed, true);
  assert.equal(JSON.parse(result.receipt).knownBytesIncludingReceipt, result.knownBytesIncludingReceipt);
});

test('bootstrap audit fails closed on absent host context even with a large override', () => {
  for (const key of contextSlots) {
    const context = empty(); delete context[key];
    const result = auditBootstrap('small packet', context, { maxBytes: 65536, reason: 'Synthetic full context' });
    assert.equal(result.complete, false, key);
    assert.equal(result.allowed, false, key);
  }
  assert.equal(auditBootstrap('', { ...empty(), tools: null }).allowed, false);
  assert.throws(() => auditBootstrap('', { ...empty(), unexpected: '' } as never), /Unknown context slot/);
});

test('whole-bootstrap ceiling includes client and override bytes and never truncates them', () => {
  assert.equal(auditBootstrap('x'.repeat(10000), empty()).allowed, false, 'receipt crosses ceiling');
  assert.equal(auditBootstrap('small', { ...empty(), tools: 'x'.repeat(10240) }).allowed, false);
  const override = { maxBytes: 16384, reason: 'Explicit synthetic larger whole-context budget' };
  const result = auditBootstrap('x'.repeat(11000), empty(), override);
  assert.equal(result.allowed, true); assert.equal(result.ordinary, false);
  assert.deepEqual(JSON.parse(result.receipt).override, override);
  assert.equal(auditBootstrap('x'.repeat(16300), empty(), override).allowed, false);
  assert.throws(() => auditBootstrap('', empty(), { maxBytes: 65536, reason: '' }), /reason/);
  const near = auditBootstrap('x'.repeat(9700), empty());
  const length = 9700 + 10240 - near.knownBytesIncludingReceipt;
  const exact = auditBootstrap('x'.repeat(length), empty());
  assert.equal(exact.knownBytesIncludingReceipt, 10240);
  assert.equal(exact.allowed, true);
  assert.equal(auditBootstrap('x'.repeat(length + 1), empty()).allowed, false);
});

test('synthetic full bootstrap preserves rules, capture/history, privacy and revision gates', () => {
  const result = evaluateSyntheticBootstrap();
  assert.ok(result.rawSourceFloor > 10240);
  assert.equal(result.measured.allowed, true);
  assert.equal(result.ordinary.allowed, false);
  assert.equal(result.unmeasured.allowed, false);
});
