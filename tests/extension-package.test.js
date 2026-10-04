import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { createReleaseZip, validateExtension } from '../scripts/extension-package.mjs';

const encode = value => new TextEncoder().encode(value);
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url));

function fixture(target = 'chrome') {
    const files = {
        'manifest.json': source(`manifest.${target}.json`),
        'background.js': encode('const background = true;'),
        'content.js': encode('console.log("content loaded");'),
        'options.js': encode('console.log("options loaded");'),
        'options.html': source('Options/options.html'),
        'options.css': source('Options/options.css'),
        'popup.js': source('Popup/popup.js'),
        'popup.html': source('Popup/popup.html'),
    };
    for (const size of [16, 32, 48, 128]) files[`icons/icon${size}.png`] = source(`icons/icon${size}.png`);
    const version = JSON.parse(new TextDecoder().decode(files['manifest.json'])).version;
    return { files, options: { target, version } };
}

function editManifest(files, edit) {
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    edit(manifest);
    files['manifest.json'] = encode(JSON.stringify(manifest));
}

test('creates deterministic, flat release archives for both browsers without changing file bytes', () => {
    for (const target of ['chrome', 'firefox']) {
        const { files, options } = fixture(target);
        const archive = createReleaseZip(files, options);
        const reordered = Object.fromEntries(Object.entries(files).reverse());
        assert.deepEqual(archive, createReleaseZip(reordered, options));
        const extracted = unzipSync(archive);
        assert.deepEqual(Object.keys(extracted).sort(), Object.keys(files).sort());
        for (const path of Object.keys(files)) assert.deepEqual(Buffer.from(extracted[path]), Buffer.from(files[path]));
        assert.equal(validateExtension(extracted, options).version, options.version);
    }
});

test('rejects browser manifest swaps and version mismatches', () => {
    const { files, options } = fixture();
    assert.throws(() => validateExtension(files, { ...options, target: 'firefox' }), /Firefox must/);
    assert.throws(() => validateExtension(files, { ...options, target: 'safari' }), /Unknown browser/);
    assert.throws(() => validateExtension(files, { ...options, version: '9.9.9' }), /version must match/);
    const firefox = fixture('firefox');
    assert.throws(() => validateExtension(firefox.files, { ...firefox.options, target: 'chrome' }), /Chrome must/);
});

test('rejects a nested manifest and missing manifest or HTML resources', () => {
    const { files, options } = fixture();
    files['dist-chrome/manifest.json'] = files['manifest.json'];
    delete files['manifest.json'];
    assert.throws(() => createReleaseZip(files, options), /archive root/);
    for (const path of ['background.js', 'content.js', 'options.js', 'options.css', 'popup.js', 'icons/icon128.png']) {
        const fresh = fixture();
        delete fresh.files[path];
        assert.throws(() => validateExtension(fresh.files, fresh.options), /Missing referenced file/);
    }
});

test('rejects unreferenced source files, unsafe paths, and ESM content scripts', () => {
    const { files, options } = fixture();
    files['templates.js'] = encode('export const source = true;');
    assert.throws(() => createReleaseZip(files, options), /Unexpected build file/);
    delete files['templates.js'];
    files['../outside.js'] = encode('');
    assert.throws(() => createReleaseZip(files, options), /Unsafe extension path/);
    delete files['../outside.js'];
    editManifest(files, manifest => { manifest.content_scripts[0].js = ['../content.js']; });
    assert.throws(() => validateExtension(files, options), /Unsafe extension path/);
    const fresh = fixture();
    fresh.files['content.js'] = encode('import { helper } from "./chunk.js";');
    assert.throws(() => validateExtension(fresh.files, fresh.options), SyntaxError);
});
