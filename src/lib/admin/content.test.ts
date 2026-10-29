import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseContentForm, parseFieldValue, parseOrgName, parsePublishStatus, publishStatusLabel } from './content';

describe('parseOrgName / parsePublishStatus / parseFieldValue', () => {
  it('naziv 2-80 karaktera', () => {
    assert.equal(parseOrgName('  Demo  Salon '), 'Demo Salon');
    assert.equal(parseOrgName('A'), null);
    assert.equal(parseOrgName('x'.repeat(81)), null);
  });
  it('status draft, published ili inactive', () => {
    assert.equal(parsePublishStatus('published'), 'published');
    assert.equal(parsePublishStatus('draft'), 'draft');
    assert.equal(parsePublishStatus('inactive'), 'inactive');
    assert.equal(parsePublishStatus('live'), null);
  });
  it('prevodi status za prikaz', () => {
    assert.equal(publishStatusLabel('published'), 'objavljen');
    assert.equal(publishStatusLabel('inactive'), 'neaktivan');
    assert.equal(publishStatusLabel('draft'), 'nacrt');
  });
  it('tekst se sece razmaci, predugacko je undefined', () => {
    assert.equal(parseFieldValue('  zdravo  ', 20), 'zdravo');
    assert.equal(parseFieldValue('', 20), '');
    assert.equal(parseFieldValue('x'.repeat(21), 20), undefined);
  });
});

describe('parseContentForm', () => {
  it('prihvata ispravan unos i ignorise nepoznata polja', () => {
    const parsed = parseContentForm({
      name: 'Demo',
      slug: 'demo-salon',
      status: 'published',
      primaryColor: '#ABC',
      values: { 'home.hero_title': 'Frizer Zemun', unknown: 'x' },
    });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.primaryColor, '#aabbcc');
    assert.equal(parsed.slug, 'demo-salon');
    assert.equal(parsed.values['home.hero_title'], 'Frizer Zemun');
    assert.equal(parsed.values['about.body'], '');
    assert.equal(parsed.guestConfirmEmail, false);
  });
  it('odbija lose ime, slug i predugacko polje', () => {
    assert.equal(
      (parseContentForm({ name: 'A', slug: 'demo', status: 'published', primaryColor: '', values: {} }) as { error: string }).error.includes(
        'Naziv',
      ),
      true,
    );
    assert.equal(
      (parseContentForm({ name: 'Demo', slug: 'www', status: 'published', primaryColor: '', values: {} }) as { error: string }).error.includes(
        'Poddomen',
      ),
      true,
    );
    const long = parseContentForm({
      name: 'Demo',
      slug: 'demo',
      status: 'published',
      primaryColor: '',
      values: { 'home.hero_title': 'x'.repeat(121) },
    });
    assert.ok('error' in long);
  });
  it('guestConfirmEmail je true samo kad je cekirano', () => {
    const off = parseContentForm({
      name: 'Demo',
      slug: 'demo',
      status: 'published',
      primaryColor: '',
      guestConfirmEmail: undefined,
      values: {},
    });
    assert.ok(!('error' in off));
    if ('error' in off) return;
    assert.equal(off.guestConfirmEmail, false);
    const on = parseContentForm({
      name: 'Demo',
      slug: 'demo',
      status: 'published',
      primaryColor: '',
      guestConfirmEmail: '1',
      values: {},
    });
    assert.ok(!('error' in on));
    if ('error' in on) return;
    assert.equal(on.guestConfirmEmail, true);
  });
});
