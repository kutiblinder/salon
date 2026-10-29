import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHexColor, textOnPrimary, whiteTextContrast } from './theme';

describe('parseHexColor', () => {
  it('prihvata 3 i 6 cifara, vraca lowercase #rrggbb', () => {
    assert.equal(parseHexColor('#ABC'), '#aabbcc');
    assert.equal(parseHexColor('  #Ff6600 '), '#ff6600');
    assert.equal(parseHexColor('#fff'), '#ffffff');
  });
  it('odbija neispravno', () => {
    assert.equal(parseHexColor('ff6600'), null);
    assert.equal(parseHexColor('#ff660'), null);
    assert.equal(parseHexColor('#gg0000'), null);
    assert.equal(parseHexColor(''), null);
  });
});

describe('textOnPrimary', () => {
  it('na tamnoj boji beli tekst, na svetloj crni', () => {
    assert.equal(textOnPrimary('#111111'), 'white');
    assert.equal(textOnPrimary('#ffe566'), 'black');
  });
  it('beli tekst na zutoj ima los kontrast', () => {
    assert.ok(whiteTextContrast('#ffe566') < 4.5);
    assert.ok(whiteTextContrast('#111111') >= 4.5);
  });
});
