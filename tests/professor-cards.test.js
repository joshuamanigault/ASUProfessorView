import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as tick, setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { startProfessorCards } from '../src/Content/professor-cards.js';

const fixture = readFileSync(new URL('./fixtures/class-results.html', import.meta.url), 'utf8');
const response = { success: true, data: { legacyId: 123, avgRating: 4.5, avgDifficulty: 2, numRatings: 10, topTags: ['Helpful'] } };

function setup(t, prefs = {}) {
    const dom = new JSDOM(fixture, { url: 'https://catalog.apps.asu.edu/catalog/classes' });
    globalThis.document = dom.window.document;
    const pending = [];
    const extension = {
        runtime: {
            id: 'test-extension',
            sendMessage(message, callback) { pending.push({ name: message.professorName, callback }); },
        },
        storage: { sync: { get(defaults, callback) { callback({ ...defaults, ...prefs }); } } },
    };
    const controller = startProfessorCards(dom.window.document, extension);
    t.after(() => { controller.disconnect(); dom.window.close(); delete globalThis.document; });
    return { doc: dom.window.document, pending, controller, extension };
}

async function flush() {
    await tick();
    await tick();
}

test('renders every instructor, outside responsive spans, without altering the name list', async t => {
    const { doc, pending } = setup(t);
    const cell = doc.getElementById('multiple');
    const originalNames = cell.firstElementChild.outerHTML;
    await flush();
    assert.deepEqual(pending.map(p => p.name), ['Phillip Miller', 'Zahra Sadri Moshkenani', 'Faye Tadayon']);
    // Resolve out of order; cards still follow the order of the ASU name list.
    pending[2].callback(response);
    pending[0].callback(response);
    pending[1].callback(response);
    await flush();
    assert.equal(doc.querySelectorAll('.rmp-card').length, 4);
    assert.equal(cell.firstElementChild.outerHTML, originalNames);
    assert.equal(cell.querySelector('.rmp-card-list').parentElement, cell);
    assert.equal(cell.querySelector('.d-none .rmp-card'), null);
    assert.deepEqual(Array.from(cell.querySelectorAll('.rmp-name')).map(el => el.textContent), pending.map(p => p.name));
    assert.equal(doc.querySelector('#staff .rmp-card-list'), null);
});

test('overlapping scans share pending lookups and our own cards do not trigger new requests', async t => {
    const { doc, pending, controller } = setup(t);
    controller.scan();
    controller.scan();
    await flush();
    assert.equal(pending.length, 3);
    pending.forEach(p => p.callback(response));
    await flush();
    controller.scan();
    await delay(300);
    assert.equal(pending.length, 3);
    assert.equal(doc.querySelectorAll('.rmp-card').length, 4);
});

test('duplicates in responsive markup and our own RMP links are excluded', async t => {
    const { doc, pending, controller } = setup(t);
    const cell = doc.getElementById('multiple');
    cell.querySelector('.d-lg-none').appendChild(cell.querySelector('a').cloneNode(true));
    const unrelated = doc.createElement('a');
    unrelated.href = 'https://example.com/help';
    unrelated.textContent = 'Help';
    cell.appendChild(unrelated);
    controller.scan();
    await flush();
    assert.equal(pending.length, 3);
    pending.forEach(p => p.callback(response));
    await flush();
    controller.scan();
    await flush();
    assert.equal(cell.querySelectorAll('.rmp-card').length, 3);
});

test('late responses cannot attach to changed or detached instructor rows', async t => {
    const { doc, pending, controller } = setup(t);
    await flush();
    const cell = doc.getElementById('multiple');
    cell.innerHTML = '<span><a href="https://search.asu.edu/profile/rmeuth">Ryan Meuth</a></span>';
    doc.getElementById('single').remove();
    controller.scan();
    pending.slice(0, 3).forEach(p => p.callback(response));
    await flush();
    assert.equal(cell.querySelector('.rmp-card'), null);
    assert.equal(pending[3].name, 'Ryan Meuth');
    pending[3].callback(response);
    await flush();
    assert.equal(doc.querySelectorAll('.rmp-card').length, 1);
    assert.equal(cell.querySelector('.rmp-name').textContent, 'Ryan Meuth');
});

test('observer processes dynamically added rows and changes to existing name text', async t => {
    const { doc, pending } = setup(t);
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const newCell = doc.createElement('div');
    newCell.className = 'class-results-cell instructor';
    newCell.innerHTML = '<a href="https://search.asu.edu/profile/rmeuth">Ryan Meuth</a>';
    doc.getElementById('results').appendChild(newCell);
    await delay(300);
    assert.equal(pending.length, 4);
    pending[3].callback(response);
    await flush();
    newCell.querySelector('a').firstChild.textContent = 'Ryan A. Meuth';
    await delay(300);
    assert.equal(pending[4].name, 'Ryan A. Meuth');
    pending[4].callback(response);
    await flush();
    assert.equal(newCell.querySelector('.rmp-name').textContent, 'Ryan A. Meuth');
});

test('rejects stale replies even before the debounced observer scans a changed row', async t => {
    const { doc, pending } = setup(t);
    await flush();
    const cell = doc.getElementById('multiple');
    cell.querySelector('a').firstChild.textContent = 'Another Professor';
    pending.forEach(p => p.callback(response));
    await flush();
    assert.equal(cell.querySelector('.rmp-card'), null);
    assert.equal(doc.querySelectorAll('#single .rmp-card').length, 1);
});

test('preserves compact, tag, and not-found rendering options', async t => {
    const { doc, pending } = setup(t, { compact_cards: true, show_tags: true });
    await flush();
    pending[0].callback(response);
    pending[1].callback({ success: false });
    pending[2].callback(response);
    await flush();
    assert.equal(doc.querySelectorAll('.rmp-compact-card').length, 4);
    assert.equal(doc.querySelectorAll('.rmp-tag').length, 3);
    assert.equal(doc.querySelectorAll('.rmp-compact-not-found-message').length, 1);
});

test('limits lookups to three and releases a permit after transport errors', async t => {
    const { doc, pending, controller, extension } = setup(t);
    const errors = t.mock.method(console, 'error', () => {});
    doc.getElementById('results').insertAdjacentHTML('beforeend', '<div class="class-results-cell instructor"><a href="https://search.asu.edu/profile/rmeuth">Ryan Meuth</a></div>');
    controller.scan();
    await flush();
    assert.equal(pending.length, 3);
    extension.runtime.lastError = { message: 'The message port closed' };
    pending[0].callback(undefined);
    delete extension.runtime.lastError;
    await flush();
    assert.equal(pending.length, 4);
    pending.slice(1).forEach(p => p.callback(response));
    await flush();
    assert.equal(doc.querySelectorAll('.rmp-card').length, 5);
    assert.equal(errors.mock.callCount(), 2); // Both rows waiting for the same failed name.
});
