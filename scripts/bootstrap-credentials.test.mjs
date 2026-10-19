import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/configuration/bootstrap.js', import.meta.url), 'utf8');
const boundary = script.indexOf('const FALLBACK_API_BASE');
assert.ok(boundary > 0, 'Generated bootstrap credential prelude must be present');
const prelude = `${script.slice(0, boundary)}})();`;
const run = (credentials, search = '') => {
    const replaced = [];
    const window = credentials === undefined ? {} : { __voltLaunchCredentials: credentials };
    vm.runInNewContext(prelude, { window, URL, location: { href: `http://localhost:4173/game${search}` },
        history: { state: null, replaceState: (...args) => replaced.push(args[2]) } });
    return { ticket: window.__voltLaunchCredentials.ssoTicket, replaced };
};

test('preserves a website ticket on the normal cookie-authenticated /game route', () => {
    assert.equal(run({ ssoTicket: 'website-ticket' }).ticket, 'website-ticket');
});
test('prefers the website ticket while removing a conflicting URL ticket', () => {
    const result = run({ ssoTicket: 'website-ticket' }, '?sso=url-ticket&room=3');
    assert.equal(result.ticket, 'website-ticket');
    assert.deepEqual(result.replaced, ['http://localhost:4173/game?room=3']);
});
test('retains developer URL entry while removing its ticket from history', () => {
    const result = run(undefined, '?sso=developer-ticket');
    assert.equal(result.ticket, 'developer-ticket');
    assert.deepEqual(result.replaced, ['http://localhost:4173/game']);
});
test('empty or malformed handoffs fall back to the URL without inventing credentials', () => {
    for(const credentials of [{ ssoTicket: '' }, { ssoTicket: 123 }, null, 'invalid']) {
        assert.equal(run(structuredClone(credentials), '?sso=url-ticket').ticket, 'url-ticket');
        assert.equal(run(structuredClone(credentials)).ticket, '');
    }
});
test('repeated bootstrap evaluation preserves an already captured ticket', () => {
    const first = run(undefined, '?sso=developer-ticket');
    assert.equal(run({ ssoTicket: first.ticket }).ticket, 'developer-ticket');
});
