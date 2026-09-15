import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFlightContinuation } from '../scripts/evaluate-flight-continuation.js';

test('synthetic flight continuation preserves bounded navigation, stale gates, pending input and checkpoint history', () => {
  const result = evaluateFlightContinuation();
  assert.equal(result.validation.errors, 0);
  assert.equal(result.budgetProposal.realSessionAdmitted, false);
});
