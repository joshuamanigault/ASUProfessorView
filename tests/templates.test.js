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

test('every card layout renders one accessible copy action only when enabled', t => {
    const dom = new JSDOM();
    globalThis.document = dom.window.document;
    t.after(() => { dom.window.close(); delete globalThis.document; });
    const data = { legacyId: 123, avgRating: 4.5, avgDifficulty: 2.5, topTags: ['Helpful'] };
    const variants = [
        ...[createProfessorCard, createCompactCard].flatMap(create => [false, true].map(showTags => ({
            create: enabled => create('Professor Name', data, showTags, enabled),
            hasTags: showTags,
        }))),
        ...[createNotFoundCard, createCompactNotFoundCard].map(create => ({
            create: enabled => create('Professor Name', enabled),
            hasTags: false,
        })),
    ];

    for (const { create, hasTags } of variants) {
        const card = create(true);
        assert.equal(card.querySelectorAll('.rmp-copy-course-number').length, 1);
        const button = card.querySelector('.rmp-copy-course-number');
        assert.equal(button.tagName, 'BUTTON');
        assert.equal(button.type, 'button');
        assert.equal(button.getAttribute('aria-label'), 'Copy class number');
        assert.equal(button.title, 'Copy class number');
        assert.equal(button.querySelector('.rmp-copy-course-number-label').textContent, 'Copy class number');
        assert.equal(button.querySelector('svg').getAttribute('aria-hidden'), 'true');
        assert.equal(button.querySelector('svg').getAttribute('focusable'), 'false');
        assert.equal(button.closest('a'), null);
        const status = card.querySelector('.rmp-copy-course-number-status');
        assert.equal(status.getAttribute('role'), 'status');
        assert.equal(status.getAttribute('aria-live'), 'polite');
        assert.equal(status.textContent, '');
        assert.equal(status.parentElement, button.parentElement);
        assert.equal(Boolean(card.querySelector('.rmp-tag')), hasTags);

        for (const enabled of [false, undefined]) {
            const disabledCard = create(enabled);
            assert.equal(disabledCard.querySelector('.rmp-copy-course-number-container'), null);
            assert.equal(Boolean(disabledCard.querySelector('.rmp-tag')), hasTags);
        }
    }
});
