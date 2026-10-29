import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseContentForm, parseFieldValue, parseOrgName, parsePublishStatus } from './content';

describe('parseOrgName / parsePublishStatus / parseFieldValue', () => {
  it('naziv 2-80 karaktera', () => {
    assert.equal(parseOrgName('  Demo  Salon '), 'Demo Salon');
    assert.equal(parseOrgName('A'), null);
    assert.equal(parseOrgName('x'.repeat(81)), null);
  });
  it('status samo draft ili published', () => {
    assert.equal(parsePublishStatus('published'), 'published');
    assert.equal(parsePublishStatus('draft'), 'draft');
    assert.equal(parsePublishStatus('live'), null);
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
      status: 'published',
      primaryColor: '#ABC',
      values: { 'home.hero_title': 'Frizer Zemun', unknown: 'x' },
    });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.primaryColor, '#aabbcc');
    assert.equal(parsed.values['home.hero_title'], 'Frizer Zemun');
    assert.equal(parsed.values['about.body'], '');
  });
  it('odbija lose ime i predugacko polje', () => {
    assert.equal(
      (parseContentForm({ name: 'A', status: 'published', primaryColor: '', values: {} }) as { error: string }).error.includes(
        'Naziv',
      ),
      true,
    );
    const long = parseContentForm({
      name: 'Demo',
      status: 'published',
      primaryColor: '',
      values: { 'home.hero_title': 'x'.repeat(121) },
    });
    assert.ok('error' in long);
  });
});
