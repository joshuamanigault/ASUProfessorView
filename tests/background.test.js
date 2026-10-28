import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import test from 'node:test';
import { runSource } from './support/runtime.js';

const professor = {
    firstName: 'Ada', lastName: 'Lovelace', legacyId: 123,
    avgRating: 4.5, avgDifficulty: 2, numRatings: 10, department: 'Computing',
};
const campuses = [
    'Arizona State University',
    'Arizona State University - Polytechnic Campus',
    'Arizona State University - West Campus',
];

function setup({ info = () => ({ ...professor }), comments = () => [], entries = {}, alarm } = {}) {
    const data = structuredClone(entries);
    const calls = [];
    const createdAlarms = [];
    const storage = {
        async get(keys) {
            return structuredClone(keys === null ? data : Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]])));
        },
        async set(update) { Object.assign(data, structuredClone(update)); },
        async remove(keys) { keys.forEach(key => delete data[key]); },
        async clear() { Object.keys(data).forEach(key => delete data[key]); },
    };
    let now = 1_000_000;
    let listener;
    let onAlarm;
    runSource('Background/background.ts', {
        require(name) {
            assert.equal(name, 'rate-my-professor-api-ts');
            return { RateMyProfessor: class {
                constructor(campus, name) { this.campus = campus; this.name = name; }
                async get_professor_info() {
                    calls.push({ campus: this.campus, name: this.name });
                    return info(this.name, this.campus);
                }
                async get_comments_by_professor() { return comments(this.name, this.campus); }
            } };
        },
        exports: {},
        Error,
        Date: class extends Date { static now() { return now; } },
        console: { error() {}, warn() {} },
        chrome: {
            storage: { local: storage },
            runtime: { onMessage: { addListener(fn) { listener = fn; } } },
            alarms: {
                async get() { return alarm; },
                async create(name, options) { createdAlarms.push({ name, ...options }); },
                onAlarm: { addListener(fn) { onAlarm = fn; } },
            },
        },
    });
    return {
        data, calls, storage, createdAlarms,
        advance(ms) { now += ms; },
        fireAlarm: name => onAlarm({ name }),
        async message(request) {
            let respond;
            const response = new Promise(resolve => { respond = resolve; });
            let replies = 0;
            assert.equal(listener(request, {}, value => { replies += 1; respond(value); }), true,
                'async replies must keep the message channel open');
            // A missing reply must fail this test, never hang the CI runner.
            const result = await response;
            await tick();
            assert.equal(replies, 1);
            return result;
        },
    };
}

test('background returns real lookup data and reuses its persistent cache until the expiry boundary', { timeout: 2000 }, async () => {
    const app = setup();
    const first = await app.message({ professorName: 'Ada Lovelace' });
    assert.equal(first.success, true);
    assert.deepEqual(JSON.parse(JSON.stringify(first.data)), professor);
    assert.equal(app.data['ada lovelace'].expiry, 1_600_000);
    app.advance(599_999);
    assert.equal((await app.message({ professorName: '  ADA LOVELACE  ' })).data.legacyId, 123);
    assert.equal(app.calls.length, 1, 'cache keys normalize case and surrounding whitespace');
    app.advance(1);
    await app.message({ professorName: 'Ada Lovelace' });
    assert.equal(app.calls.length, 2, 'an entry expiring now must be refreshed');
});

test('searches every ASU campus and supported name form without accepting an unrelated professor', { timeout: 2000 }, async () => {
    for (const [name, campus] of [
        ['Ada Byron Lovelace', campuses[2]],
        ['Ada Lovelace', campuses[1]],
        ['Ada Byron-Lovelace', campuses[0]],
    ]) {
        const app = setup({ info: (searchedName, searchedCampus) => searchedName === name && searchedCampus === campus
            ? { ...professor, firstName: 'Ada', lastName: name.slice(4) }
            : { ...professor, firstName: 'Unrelated' } });
        const result = await app.message({ professorName: 'Ada Byron Lovelace' });
        assert.equal(result.success, true, `${name} at ${campus}`);
        assert.equal(result.data.lastName, name.slice(4));
        assert.deepEqual(app.calls.at(-1), { name, campus });
    }
});

test('not-found and upstream failures reply once, are not cached, and allow a later successful retry', { timeout: 2000 }, async () => {
    let available = false;
    const app = setup({ info: () => {
        if (available) return { ...professor };
        throw new Error('Upstream unavailable');
    } });
    assert.equal((await app.message({ professorName: 'Ada Lovelace' })).success, false);
    assert.equal(Object.keys(app.data).length, 0);
    available = true;
    assert.equal((await app.message({ professorName: 'Ada Lovelace' })).success, true);
    const missing = setup({ info: () => null });
    assert.equal((await missing.message({ professorName: 'Ada Lovelace' })).success, false);
});

test('returns at most five common tags and still returns a professor when comments fail', { timeout: 2000 }, async () => {
    const app = setup({ comments: () => [
        { rating_tags: 'Rare--Helpful--Clear--Fair--Engaging--Tough' },
        { rating_tags: 'Helpful--Clear--Fair--Engaging--Tough' },
        {},
    ] });
    const result = await app.message({ professorName: 'Ada Lovelace' });
    assert.deepEqual(Array.from(result.data.topTags), ['Helpful', 'Clear', 'Fair', 'Engaging', 'Tough']);
    const failing = setup({ comments: () => { throw new Error('Comments unavailable'); } });
    assert.equal((await failing.message({ professorName: 'Ada Lovelace' })).success, true);
});

test('cache storage failures do not discard an otherwise available professor', { timeout: 2000 }, async () => {
    for (const operation of ['get', 'set', 'remove']) {
        const app = setup({ entries: { 'ada lovelace': { value: professor, expiry: 0 } } });
        app.storage[operation] = async () => { throw new Error('Storage unavailable'); };
        const result = await app.message({ professorName: 'Ada Lovelace' });
        assert.equal(result.success, true, `cache ${operation} is optional`);
        assert.equal(result.data.legacyId, 123);
    }
});

test('clear-cache acknowledges completion and reports storage failures', { timeout: 2000 }, async () => {
    const app = setup({ entries: { 'ada lovelace': { value: professor, expiry: 2_000_000 } } });
    assert.equal((await app.message({ type: 'clearProfessorCache' })).success, true);
    assert.deepEqual(app.data, {});
    app.storage.clear = async () => { throw new Error('Clear denied'); };
    const result = await app.message({ type: 'clearProfessorCache' });
    assert.equal(result.success, false);
    assert.match(result.error, /Clear denied/);
});

test('startup installs only a missing cleanup alarm, and cleanup removes only expired entries', async () => {
    const app = setup({ entries: {
        expired: { value: professor, expiry: 1_000_000 },
        fresh: { value: professor, expiry: 1_000_001 },
        other: { setting: true },
    } });
    await tick();
    assert.equal(app.createdAlarms.length, 1);
    assert.ok(app.createdAlarms[0].periodInMinutes > 0);
    await app.fireAlarm('unrelated');
    assert.ok(app.data.expired);
    await app.fireAlarm(app.createdAlarms[0].name);
    assert.deepEqual(Object.keys(app.data).sort(), ['fresh', 'other']);
    const existing = setup({ alarm: { name: app.createdAlarms[0].name } });
    await tick();
    assert.equal(existing.createdAlarms.length, 0);
});
