import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookableLocations } from './booking';

describe('bookableLocations', () => {
  it('ostavlja samo lokacije sa cenom', () => {
    const locs = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ];
    assert.deepEqual(bookableLocations(locs, [{ locationId: '2' }]), [{ id: '2', name: 'B' }]);
    assert.equal(bookableLocations(locs, []).length, 0);
    assert.equal(bookableLocations(locs, [{ locationId: '1' }, { locationId: '2' }]).length, 2);
  });
});
