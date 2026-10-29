import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { domainAliases } from './tls-ask';
import { tenantKeyFromHost } from './tenant-key';

describe('domainAliases', () => {
  it('www i apex su par', () => {
    assert.deepEqual(domainAliases('www.frizer.rs'), ['www.frizer.rs', 'frizer.rs']);
    assert.deepEqual(domainAliases('frizer.rs'), ['frizer.rs', 'www.frizer.rs']);
  });
});

describe('tls host klasifikacija', () => {
  it('platforma i slug prolaze kroz tenant-key', () => {
    assert.equal(tenantKeyFromHost('tvojsajt.rs', 'tvojsajt.rs')?.kind, 'platform');
    assert.equal(tenantKeyFromHost('demo.tvojsajt.rs', 'tvojsajt.rs')?.kind, 'slug');
    assert.equal(tenantKeyFromHost('frizer.rs', 'tvojsajt.rs')?.kind, 'domain');
    assert.equal(tenantKeyFromHost('a.b.tvojsajt.rs', 'tvojsajt.rs'), null);
  });
});
