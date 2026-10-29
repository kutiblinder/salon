import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { availableActions, canTransition, isPanelStatusAction } from './status';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const PAST = NOW - 60_000;
const FUTURE = NOW + 60_000;

describe('canTransition', () => {
  it('salon potvrdjuje samo pending termin', () => {
    assert.equal(canTransition('pending', 'confirmed', FUTURE, NOW), true);
    assert.equal(canTransition('confirmed', 'confirmed', FUTURE, NOW), false);
    assert.equal(canTransition('cancelled_by_client', 'confirmed', FUTURE, NOW), false);
  });

  it('otkazuje pending i confirmed, ali ne zavrsene ni otkazane', () => {
    assert.equal(canTransition('pending', 'cancelled_by_salon', FUTURE, NOW), true);
    assert.equal(canTransition('confirmed', 'cancelled_by_salon', PAST, NOW), true);
    assert.equal(canTransition('completed', 'cancelled_by_salon', PAST, NOW), false);
    assert.equal(canTransition('cancelled_by_salon', 'cancelled_by_salon', FUTURE, NOW), false);
  });

  it('completed/no_show samo za potvrdjen termin koji je poceo', () => {
    assert.equal(canTransition('confirmed', 'completed', PAST, NOW), true);
    assert.equal(canTransition('confirmed', 'no_show', NOW, NOW), true);
    assert.equal(canTransition('confirmed', 'completed', FUTURE, NOW), false);
    assert.equal(canTransition('pending', 'no_show', PAST, NOW), false);
    assert.equal(canTransition('no_show', 'completed', PAST, NOW), false);
  });
});

describe('availableActions', () => {
  it('buduci potvrdjen termin moze samo da se otkaze', () => {
    assert.deepEqual(availableActions('confirmed', FUTURE, NOW), ['cancelled_by_salon']);
  });
  it('protekli potvrdjen termin: otkaz, zavrsen, nije dosao', () => {
    assert.deepEqual(availableActions('confirmed', PAST, NOW), [
      'cancelled_by_salon',
      'completed',
      'no_show',
    ]);
  });
  it('zavrsen termin nema akcija', () => {
    assert.deepEqual(availableActions('completed', PAST, NOW), []);
  });
});

describe('isPanelStatusAction', () => {
  it('odbija statuse koje salon ne sme da postavi', () => {
    assert.equal(isPanelStatusAction('no_show'), true);
    assert.equal(isPanelStatusAction('cancelled_by_client'), false);
    assert.equal(isPanelStatusAction('pending'), false);
    assert.equal(isPanelStatusAction(42), false);
  });
});
