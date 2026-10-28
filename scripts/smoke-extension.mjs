import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as tick } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const fixture = readFileSync(new URL('tests/fixtures/class-results.html', root), 'utf8');

for (const target of ['chrome', 'firefox']) {
    const read = path => readFileSync(new URL(`dist-${target}/${path}`, root), 'utf8');
    const manifest = JSON.parse(read('manifest.json'));
    const local = {};
    const prefs = {};
    const pending = new Set();
    const errors = [];
    const windows = [];
    let listener;
    let fetches = 0;
    const chrome = {
        runtime: {
            id: 'production-smoke',
            onMessage: { addListener(fn) { listener = fn; } },
            sendMessage(request, callback) {
                let done;
                const response = new Promise(resolve => { done = resolve; });
                pending.add(response);
                assert.equal(listener(request, {}, value => {
                    callback(structuredClone(value));
                    pending.delete(response);
                    done();
                }), true, 'the background must keep async message channels open');
            },
        },
        storage: {
            local: {
                async get(keys) {
                    return structuredClone(keys === null ? local : Object.fromEntries(keys.filter(key => key in local).map(key => [key, local[key]])));
                },
                async set(update) { Object.assign(local, structuredClone(update)); },
                async remove(keys) { keys.forEach(key => delete local[key]); },
                async clear() { Object.keys(local).forEach(key => delete local[key]); },
            },
            sync: {
                get(defaults, callback) { callback({ ...defaults, ...prefs }); },
                set(update, callback) { Object.assign(prefs, update); callback(); },
            },
        },
        alarms: { async get() {}, async create() {}, onAlarm: { addListener() {} } },
    };

    // Stub HTTP only: the shipped RMP dependency still constructs queries and parses responses.
    async function fetch(url, options) {
        fetches += 1;
        assert.equal(url, 'https://www.ratemyprofessors.com/graphql');
        assert.equal(options.method, 'POST');
        const { query, variables } = JSON.parse(options.body);
        let data;
        if (query.includes('NewSearchSchoolsQuery')) {
            data = { newSearch: { schools: { edges: [{ node: { id: 'school-asu', name: variables.query.text } }] } } };
        } else if (query.includes('TeacherSearchResultsPageQuery')) {
            assert.equal(variables.query.schoolID, 'school-asu');
            const name = variables.query.text;
            const node = name === 'Phillip Miller'
                ? { firstName: 'Phillip', lastName: 'Miller', legacyId: 123 }
                : name === 'Zahra Sadri Moshkenani'
                    ? { firstName: 'Zahra', lastName: 'Sadri Moshkenani', legacyId: 456 }
                    : { firstName: 'Unrelated', lastName: 'Professor', legacyId: 789 };
            data = { search: { teachers: { edges: [{ node: {
                ...node, id: `teacher-${node.legacyId}`, avgRating: 4.5, avgDifficulty: 2, numRatings: 10, department: 'Computing',
            } }] } } };
        } else if (query.includes('RatingsListQuery')) {
            assert.match(variables.id, /^teacher-(123|456)$/);
            data = { node: { ratings: { edges: [{ node: { ratingTags: 'Helpful--Clear' } }] } } };
        } else {
            throw new Error('Unexpected RMP operation');
        }
        return { ok: true, async json() { return { data }; } };
    }

    async function settle() {
        for (let attempts = 0; attempts < 50; attempts += 1) {
            await tick();
            if (!pending.size) { await tick(); return; }
        }
        assert.fail('background requests did not complete');
    }

    function page(html, url = 'https://extension.invalid/') {
        const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
        windows.push(dom.window);
        dom.window.chrome = chrome;
        return dom.window;
    }

    try {
        const backgroundPath = manifest.background.service_worker ?? manifest.background.scripts[0];
        runInNewContext(read(backgroundPath), {
            chrome, fetch, console: { error(...args) { errors.push(args); }, warn() {} },
        }, { filename: `${target}/${backgroundPath}` });

        const options = page(read(manifest.options_page));
        options.eval(read('options.js'));
        await tick();
        assert.equal(options.document.getElementById('copy-course-number').getAttribute('aria-checked'), 'true');
        for (const id of ['compact-cards', 'show-tags']) options.document.getElementById(id).click();
        await tick();
        assert.deepEqual(prefs, { compact_cards: true, show_tags: true });

        const content = page(fixture, 'https://catalog.apps.asu.edu/catalog/classes');
        const copied = [];
        Object.defineProperty(content.navigator, 'clipboard', {
            value: { async writeText(number) { copied.push(number); } },
        });
        for (const path of manifest.content_scripts[0].js) content.eval(read(path));
        await settle();
        const doc = content.document;
        assert.deepEqual(errors, [], 'production bundles must not log unexpected runtime errors');
        assert.equal(doc.querySelectorAll('.rmp-card').length, 4);
        assert.equal(doc.querySelectorAll('.rmp-compact-card').length, 4);
        assert.equal(doc.querySelectorAll('.rmp-compact-not-found-message').length, 1);
        assert.equal(doc.querySelectorAll('.rmp-tag').length, 6);
        const foundLink = doc.querySelector('#single .rmp-card a');
        assert.equal(foundLink.textContent, 'Phillip Miller');
        assert.equal(foundLink.href, 'https://www.ratemyprofessors.com/professor/123');
        assert.deepEqual([...doc.querySelectorAll('#single .rmp-rating-badge')].map(el => el.textContent.trim()), ['4.5', '2.0']);
        for (const id of ['multiple', 'single']) doc.getElementById(id).querySelector('.rmp-copy-course-number').click();
        await tick();
        assert.deepEqual(copied, ['15448', '15449']);

        const beforeCacheHit = fetches;
        let cachedReply;
        chrome.runtime.sendMessage({ professorName: 'Phillip Miller' }, reply => { cachedReply = reply; });
        await settle();
        assert.equal(cachedReply.success, true);
        assert.equal(fetches, beforeCacheHit, 'persistent cache must avoid HTTP calls');
        assert.equal(Object.keys(local).length, 2, 'only successful matches are cached');

        const popup = page(read(manifest.action.default_popup));
        popup.eval(read('popup.js'));
        popup.document.getElementById('clear-cache-button').click();
        await settle();
        assert.equal(popup.document.getElementById('clear-cache-button-label').textContent, 'Cache Cleared!');
        assert.deepEqual(local, {});
        assert.deepEqual(errors, [], 'production bundles must not log unexpected runtime errors');
        console.log(`${target}: shipped settings → content → background → RMP HTTP fixtures, cache, clipboard, and popup passed`);
    } finally {
        windows.forEach(win => win.close());
    }
}
