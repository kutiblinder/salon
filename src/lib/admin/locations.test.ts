import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHoursForm, parseLocationName, parseOptionalEmail, parseSlotStep } from './locations-types';

describe('parseLocationName / parseOptionalEmail / parseSlotStep', () => {
  it('naziv 2–80 karaktera', () => {
    assert.equal(parseLocationName('  Zemun  centar '), 'Zemun centar');
    assert.equal(parseLocationName('A'), null);
  });
  it('email prazan je null, los je undefined', () => {
    assert.equal(parseOptionalEmail(''), null);
    assert.equal(parseOptionalEmail('Ana@Salon.rs'), 'ana@salon.rs');
    assert.equal(parseOptionalEmail('nije'), undefined);
  });
  it('korak termina 5–60, prazno 15', () => {
    assert.equal(parseSlotStep(''), 15);
    assert.equal(parseSlotStep('30'), 30);
    assert.equal(parseSlotStep('3'), null);
  });
});

describe('parseHoursForm', () => {
  it('uzima samo otvorene dane sa ispravnim vremenom', () => {
    const data = new FormData();
    data.set('open_0', 'on');
    data.set('opens_0', '09:00');
    data.set('closes_0', '17:00');
    data.set('opens_1', '08:00');
    data.set('closes_1', '16:00');
    const hours = parseHoursForm(data);
    assert.ok(!('error' in hours));
    if ('error' in hours) return;
    assert.deepEqual(hours, [{ weekday: 0, opens: '09:00', closes: '17:00' }]);
  });
  it('odbija otvoren dan bez ispravnog intervala', () => {
    const data = new FormData();
    data.set('open_0', 'on');
    data.set('opens_0', '17:00');
    data.set('closes_0', '09:00');
    const hours = parseHoursForm(data);
    assert.ok('error' in hours);
  });
});
