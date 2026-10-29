import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCustomDomain } from './domains';

describe('parseCustomDomain', () => {
  it('normalizuje protokol, putanju, port i velika slova', () => {
    assert.equal(parseCustomDomain('HTTPS://WWW.Frizer-Ana.RS:443/put', 'tvojsajt.rs'), 'www.frizer-ana.rs');
  });
  it('odbija subdomen i sam domen platforme', () => {
    assert.equal(parseCustomDomain('demo.tvojsajt.rs', 'tvojsajt.rs'), null);
    assert.equal(parseCustomDomain('tvojsajt.rs', 'tvojsajt.rs'), null);
    assert.equal(parseCustomDomain('www.tvojsajt.rs', 'tvojsajt.rs'), null);
  });
  it('odbija localhost, IP i neispravan hostname', () => {
    assert.equal(parseCustomDomain('localhost', 'localhost'), null);
    assert.equal(parseCustomDomain('demo.localhost', 'localhost'), null);
    assert.equal(parseCustomDomain('10.0.0.1', 'tvojsajt.rs'), null);
    assert.equal(parseCustomDomain('nije domen', 'tvojsajt.rs'), null);
    assert.equal(parseCustomDomain('-x.rs', 'tvojsajt.rs'), null);
  });
  it('prihvata ispravan custom domen', () => {
    assert.equal(parseCustomDomain('frizerka-ana.rs', 'tvojsajt.rs'), 'frizerka-ana.rs');
  });
});
