import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as tick } from 'node:timers/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { sourceScript } from './support/runtime.js';

function page(t, name, chrome) {
    const html = readFileSync(new URL(`../src/${name}/${name.toLowerCase()}.html`, import.meta.url), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://extension.invalid/' });
    dom.window.chrome = chrome;
    t.after(() => dom.window.close());
    return dom.window;
}

const settings = [
    ['compact_cards', 'compact-cards', false],
    ['show_tags', 'show-tags', false],
    ['copy_course_number', 'copy-course-number', true],
];

test('settings load defaults and saved values, persist independent mouse/keyboard changes, and survive reload', async t => {
    for (const stored of [{}, { compact_cards: true, show_tags: true, copy_course_number: false }]) {
        const values = { ...stored };
        const writes = [];
        const chrome = { storage: { sync: {
            get(defaults, callback) { callback({ ...defaults, ...values }); },
            set(update, callback) { writes.push({ ...update }); Object.assign(values, update); callback(); },
        } } };
        const win = page(t, 'Options', chrome);
        win.eval(sourceScript('Options/options.ts'));
        await tick();
        for (const [index, [key, id, fallback]] of settings.entries()) {
            const control = win.document.getElementById(id);
            const initial = stored[key] ?? fallback;
            assert.equal(control.getAttribute('aria-checked'), String(initial), id);
            assert.equal(control.classList.contains('checked'), initial);
            if (index === 0) control.click();
            else control.dispatchEvent(new win.KeyboardEvent('keydown', { key: index === 1 ? ' ' : 'Enter', bubbles: true }));
            await tick();
            assert.equal(control.getAttribute('aria-checked'), String(!initial));
            assert.deepEqual(writes.at(-1), { [key]: !initial }, 'changing one setting must not overwrite others');
        }
        assert.equal(writes.length, settings.length);
        const reloaded = page(t, 'Options', chrome);
        reloaded.eval(sourceScript('Options/options.ts'));
        await tick();
        for (const [key, id] of settings) {
            assert.equal(reloaded.document.getElementById(id).getAttribute('aria-checked'), String(values[key]));
        }
    }
});

test('popup clears via the background message contract and reports success, rejection, and transport failure', async t => {
    let reply = { success: true };
    let transportError;
    const sent = [];
    const runtime = {
        sendMessage(request, callback) {
            sent.push(request.type);
            runtime.lastError = transportError;
            callback(reply);
            delete runtime.lastError;
        },
    };
    const win = page(t, 'Popup', { runtime });
    const timers = [];
    win.setTimeout = callback => { timers.push(callback); return timers.length; };
    win.console.error = () => {};
    win.eval(sourceScript('Popup/popup.js'));
    const button = win.document.getElementById('clear-cache-button');
    const label = win.document.getElementById('clear-cache-button-label');
    for (const failure of [false, true, 'transport']) {
        reply = failure ? { success: false, error: 'Storage denied' } : { success: true };
        transportError = failure === 'transport' ? { message: 'Port closed' } : undefined;
        button.click();
        assert.equal(sent.at(-1), 'clearProfessorCache');
        assert.match(label.textContent, failure ? /Failed to Clear/ : /Cache Cleared/);
        assert.equal(timers.length, 1);
        timers.shift()();
        assert.equal(label.textContent, 'Clear Cache');
    }
    assert.equal(sent.length, 3);
});
