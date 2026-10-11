import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createProfessorCard, createCompactCard, createNotFoundCard, createCompactNotFoundCard } from '../src/Content/templates.js';

test('only positive safe integer IDs become RMP links, in either layout', t => {
    const dom = new JSDOM();
    globalThis.document = dom.window.document;
    t.after(() => { dom.window.close(); delete globalThis.document; });
    for (const create of [createProfessorCard, createCompactCard]) {
        for (const legacyId of [123, '123']) {
            const card = create('Professor Name', { legacyId }, false);
            const link = card.querySelector('a');
            assert.equal(link.href, 'https://www.ratemyprofessors.com/professor/123');
            assert.equal(link.rel, 'noopener noreferrer');
            assert.equal(link.target, '_blank');
        }
        for (const legacyId of ['123"><img src=x onerror=alert(1)>', 'javascript:alert(1)', -1, 0, 1.5, Infinity, NaN, null, undefined, {}, Number.MAX_SAFE_INTEGER + 1]) {
            const card = create('Professor Name', { legacyId }, false);
            assert.equal(card.querySelector('a, img, script, [onerror]'), null);
            assert.match(card.textContent, /Professor Name/);
        }
    }
});

test('untrusted names, departments, review counts, and tags remain text', t => {
    const dom = new JSDOM();
    globalThis.document = dom.window.document;
    t.after(() => { dom.window.close(); delete globalThis.document; });
    const hostile = '<img src=x onerror=alert(1)> & "quotes"';
    for (const create of [createProfessorCard, createCompactCard]) {
        const card = create(hostile, { legacyId: 123, department: hostile, numRatings: hostile, topTags: [hostile] }, true);
        assert.equal(card.querySelector('img, script, [onerror]'), null);
        assert.equal(card.querySelector('a').textContent, hostile);
        assert.equal(card.querySelector('.rmp-tag').textContent, hostile);
    }
    for (const create of [createNotFoundCard, createCompactNotFoundCard]) {
        const card = create(hostile);
        assert.equal(card.querySelector('img, script, [onerror]'), null);
        assert.equal(new URL(card.querySelector('a').href).searchParams.get('q'), hostile);
    }
});
