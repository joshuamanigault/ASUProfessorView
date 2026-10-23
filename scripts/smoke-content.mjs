import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as tick } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const fixture = readFileSync(new URL('tests/fixtures/class-results.html', root), 'utf8');
for (const target of ['chrome', 'firefox']) {
    const dom = new JSDOM(fixture, {
        url: 'https://catalog.apps.asu.edu/catalog/classes',
        runScripts: 'outside-only',
    });
    const requests = [];
    const copied = [];
    Object.defineProperty(dom.window.navigator, 'clipboard', {
        value: { async writeText(value) { copied.push(value); } },
    });
    dom.window.chrome = {
        runtime: {
            id: 'bundle-smoke-test',
            sendMessage(request, callback) {
                requests.push(request.professorName);
                queueMicrotask(() => callback({
                    success: true,
                    data: { legacyId: 123, avgRating: 4.5, avgDifficulty: 2, numRatings: 10 },
                }));
            },
        },
        storage: { sync: { get(defaults, callback) { callback(defaults); } } },
    };
    try {
        // Exercise the shipped classic bundle, including bundled styles and dependencies.
        dom.window.eval(readFileSync(new URL(`dist-${target}/content.js`, root), 'utf8'));
        await tick();
        await tick();
        const doc = dom.window.document;
        assert.equal(requests.length, 3);
        assert.equal(doc.querySelectorAll('.rmp-card').length, 4);
        assert.equal(doc.querySelectorAll('#multiple > .rmp-card-list > .rmp-card-slot').length, 3);
        assert.equal(doc.querySelector('.d-none .rmp-card'), null);
        assert.equal(doc.querySelectorAll('#rmp-card-styles').length, 1);
        assert.ok(doc.getElementById('rmp-card-styles').textContent.includes('.rmp-card-list'));
        assert.equal(doc.querySelectorAll('.rmp-copy-course-number').length, 4);
        for (const id of ['multiple', 'single']) {
            const button = doc.getElementById(id).querySelector('.rmp-copy-course-number');
            button.click();
            await tick();
            assert.equal(button.disabled, false);
            assert.equal(button.dataset.copyState, 'success');
            assert.equal(doc.getElementById(id).querySelector('.rmp-copy-course-number-status').textContent, 'Copied!');
        }
        assert.deepEqual(copied, ['15448', '15449']);
        console.log(`${target}: shipped content bundle injected styles, all instructor cards, and working class-number copy buttons`);
    } finally {
        dom.window.close();
    }
}
