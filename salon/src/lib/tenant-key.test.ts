import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHost, tenantKeyFromHost } from './tenant-key';

test('normalizeHost uklanja port, velika slova i tacku na kraju', () => {
  assert.equal(normalizeHost('Demo.Localhost:3000'), 'demo.localhost');
  assert.equal(normalizeHost('ana.tvojsajt.rs.'), 'ana.tvojsajt.rs');
  assert.equal(normalizeHost(null), null);
  assert.equal(normalizeHost(''), null);
});

test('subdomen daje slug salona', () => {
  assert.deepEqual(tenantKeyFromHost('demo.localhost:3000', 'localhost'), { kind: 'slug', slug: 'demo' });
  assert.deepEqual(tenantKeyFromHost('ana.tvojsajt.rs', 'tvojsajt.rs'), { kind: 'slug', slug: 'ana' });
});

test('osnovni domen je pocetna platforme', () => {
  assert.deepEqual(tenantKeyFromHost('localhost:3000', 'localhost'), { kind: 'platform' });
  assert.deepEqual(tenantKeyFromHost('www.tvojsajt.rs', 'tvojsajt.rs'), { kind: 'platform' });
});

test('nepoznat domen se tretira kao custom domen', () => {
  assert.deepEqual(tenantKeyFromHost('frizerka-ana.rs', 'tvojsajt.rs'), { kind: 'domain', domain: 'frizerka-ana.rs' });
});

test('visenivovski ili nevalidan subdomen se odbija', () => {
  assert.equal(tenantKeyFromHost('a.b.tvojsajt.rs', 'tvojsajt.rs'), null);
  assert.equal(tenantKeyFromHost('-x.tvojsajt.rs', 'tvojsajt.rs'), null);
});

test('hostile slicni domenu ne prolaze kao subdomen', () => {
  // evil-tvojsajt.rs NIJE subdomen od tvojsajt.rs
  assert.deepEqual(tenantKeyFromHost('evil-tvojsajt.rs', 'tvojsajt.rs'), { kind: 'domain', domain: 'evil-tvojsajt.rs' });
});
