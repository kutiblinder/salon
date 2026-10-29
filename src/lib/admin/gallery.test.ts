import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sniffImage } from '../images';
import { parseAltText, parseCaption, parseOptionalLocationId } from './gallery';

describe('parseAltText / parseCaption / parseOptionalLocationId', () => {
  it('alt je obavezan, do 120 karaktera', () => {
    assert.equal(parseAltText('  Fade  '), 'Fade');
    assert.equal(parseAltText(''), null);
    assert.equal(parseAltText('x'.repeat(121)), null);
  });
  it('opis je opcion, predugacko je undefined', () => {
    assert.equal(parseCaption(''), null);
    assert.equal(parseCaption('  ok  '), 'ok');
    assert.equal(parseCaption('x'.repeat(201)), undefined);
  });
  it('lokacija: prazno = null, UUID ili greska', () => {
    assert.equal(parseOptionalLocationId(''), null);
    assert.equal(parseOptionalLocationId('not-a-uuid'), undefined);
    assert.equal(
      parseOptionalLocationId('22222222-2222-4222-8222-222222222222'),
      '22222222-2222-4222-8222-222222222222',
    );
  });
});

describe('sniffImage', () => {
  it('prepoznaje JPEG, PNG i WebP po magiji, ostalo odbija', () => {
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'jpeg');
    assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    assert.equal(sniffImage(webp), 'webp');
    assert.equal(sniffImage(Buffer.from('hello')), null);
  });
});
