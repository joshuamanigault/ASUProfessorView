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

async function waitFor(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, 'expected DOM update before timeout');
        await delay(10);
    }
}

function setClipboard(doc, writeText) {
    Object.defineProperty(doc.defaultView.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
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
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { doc, pending, controller } = setup(t);
    controller.scan();
    controller.scan();
    await flush();
    assert.equal(pending.length, 3);
    pending.forEach(p => p.callback(response));
    await flush();
    controller.scan();
    await flush();
    t.mock.timers.tick(1000);
    await flush();
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
    await waitFor(() => pending.length >= 4);
    assert.equal(pending.length, 4);
    pending[3].callback(response);
    await flush();
    newCell.querySelector('a').firstChild.textContent = 'Ryan A. Meuth';
    await waitFor(() => pending.length >= 5);
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

test('limits lookups to three and releases a permit after transport errors', async t => {
    const { doc, pending, controller, extension } = setup(t);
    t.mock.method(console, 'error', () => {});
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
});

test('copies the current class number for each row, including shared and multiple instructors', async t => {
    const { doc, pending, controller } = setup(t);
    const copied = [];
    setClipboard(doc, async value => { copied.push(value); });
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const buttons = [...doc.querySelectorAll('.rmp-copy-course-number')];
    assert.equal(buttons.length, 4);
    buttons.forEach(button => button.click());
    assert.deepEqual(copied, ['15448', '15448', '15448', '15449']);
    await flush();
    assert.ok(buttons.every(button => !button.disabled));
    assert.ok([...doc.querySelectorAll('.rmp-copy-course-number-status')].every(status => status.textContent === 'Copied!'));

    const cell = doc.getElementById('multiple');
    cell.closest('.class-accordion').querySelector('.number').innerHTML = '<div><span class="sr-only">Class number: </span>24567</div>';
    controller.scan();
    await flush();
    assert.equal(pending.length, 3);
    assert.equal(cell.querySelector('.rmp-copy-course-number'), buttons[0]);
    buttons[0].click();
    await flush();
    assert.equal(copied.at(-1), '24567');
});

test('stored options reach found and missing cards in both layouts', async t => {
    // Template tests cover the full rendering matrix; these cases verify storage wiring.
    for (const prefs of [
        { compact_cards: false, show_tags: false, copy_course_number: false },
        { compact_cards: true, show_tags: true, copy_course_number: true },
    ]) {
        await t.test(JSON.stringify(prefs), async t => {
            const { doc, pending } = setup(t, prefs);
            const copied = [];
            setClipboard(doc, async value => { copied.push(value); });
            await flush();
            pending[0].callback(response);
            pending[1].callback({ success: false });
            pending[2].callback(response);
            await flush();
            assert.equal(doc.querySelectorAll('.rmp-card').length, 4);
            assert.equal(doc.querySelectorAll('.rmp-compact-card').length, prefs.compact_cards ? 4 : 0);
            assert.equal(doc.querySelectorAll('.rmp-tag').length, prefs.show_tags ? 3 : 0);
            assert.equal(doc.querySelectorAll(prefs.compact_cards ? '.rmp-compact-not-found-message' : '.rmp-not-found').length, 1);
            const buttons = [...doc.querySelectorAll('.rmp-copy-course-number')];
            assert.equal(buttons.length, prefs.copy_course_number ? 4 : 0);
            buttons.forEach(button => button.click());
            await flush();
            assert.deepEqual(copied, prefs.copy_course_number ? ['15448', '15448', '15448', '15449'] : []);
        });
    }
});

test('prevents duplicate writes while pending and allows another copy after completion', async t => {
    const { doc, pending } = setup(t);
    const copied = [];
    let finishCopy;
    setClipboard(doc, value => {
        copied.push(value);
        return new Promise(resolve => { finishCopy = resolve; });
    });
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const button = doc.querySelector('.rmp-copy-course-number');
    button.click();
    assert.deepEqual(copied, ['15448']); // Invoked synchronously within the click.
    assert.equal(button.disabled, true);
    button.click();
    assert.equal(copied.length, 1);
    finishCopy();
    await flush();
    assert.equal(button.disabled, false);
    button.click();
    assert.deepEqual(copied, ['15448', '15448']);
    finishCopy();
    await flush();
});

test('clipboard failures show feedback and permit a successful retry', async t => {
    const { doc, pending } = setup(t);
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const button = doc.querySelector('.rmp-copy-course-number');
    const status = doc.querySelector('.rmp-copy-course-number-status');
    for (const writeText of [
        () => { throw new Error('Clipboard denied'); },
        async () => { throw new Error('Clipboard denied'); },
    ]) {
        setClipboard(doc, writeText);
        button.click();
        await flush();
        assert.equal(button.disabled, false);
        assert.equal(button.dataset.copyState, 'error');
        assert.match(status.textContent, /could not copy/i);
    }
    const copied = [];
    setClipboard(doc, async value => { copied.push(value); });
    button.click();
    await flush();
    assert.deepEqual(copied, ['15448']);
    assert.equal(button.dataset.copyState, 'success');
    assert.equal(status.textContent, 'Copied!');
});

test('unavailable clipboard and missing or malformed numbers never copy another row', async t => {
    const { doc, pending } = setup(t);
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const cell = doc.getElementById('multiple');
    const button = cell.querySelector('.rmp-copy-course-number');
    const status = cell.querySelector('.rmp-copy-course-number-status');
    button.click();
    await flush();
    assert.match(status.textContent, /clipboard unavailable/i);
    const copied = [];
    setClipboard(doc, async value => { copied.push(value); });
    const numberCell = cell.closest('.class-accordion').querySelector('.number');
    for (const text of ['', 'CSE 110', '15448 15449', 'Class number: 15448']) {
        numberCell.textContent = text;
        button.click();
        await flush();
        assert.equal(button.dataset.copyState, 'error');
        assert.match(status.textContent, /class number unavailable/i);
    }
    numberCell.remove();
    button.click();
    await flush();
    assert.deepEqual(copied, []);
    assert.match(status.textContent, /class number unavailable/i);
    assert.equal(doc.getElementById('single').closest('.class-accordion').querySelector('.number').textContent.trim(), 'Class number: 15449');
});

test('copy clicks and activation keys do not trigger the enclosing ASU accordion', async t => {
    const { doc, pending } = setup(t);
    setClipboard(doc, async () => {});
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const button = doc.querySelector('.rmp-copy-course-number');
    const row = button.closest('.class-accordion');
    const keys = [];
    let clicks = 0;
    row.addEventListener('click', () => { clicks += 1; });
    row.addEventListener('keydown', event => { keys.push(event.key); });
    for (const key of ['Enter', ' ', 'ArrowDown']) {
        button.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key, bubbles: true }));
    }
    button.click();
    await flush();
    assert.equal(clicks, 0);
    assert.deepEqual(keys, ['ArrowDown']);
});

test('detached cards and disconnected controllers cannot copy or report pending success', async t => {
    const { doc, pending, controller } = setup(t);
    const copied = [];
    let finishCopy;
    setClipboard(doc, value => {
        copied.push(value);
        return new Promise(resolve => { finishCopy = resolve; });
    });
    await flush();
    pending.forEach(p => p.callback(response));
    await flush();
    const detached = doc.querySelector('#single .rmp-card');
    detached.remove();
    detached.querySelector('.rmp-copy-course-number').click();
    assert.deepEqual(copied, []);
    const button = doc.querySelector('.rmp-copy-course-number');
    button.click();
    controller.disconnect();
    finishCopy();
    await flush();
    assert.equal(button.disabled, false);
    assert.equal(doc.querySelector('.rmp-copy-course-number-status').textContent, '');
    button.click();
    assert.deepEqual(copied, ['15448']);
});
