import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { JSDOM } from 'jsdom';
import { unzipSync, zipSync } from 'fflate';

function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function requireSafePath(path) {
    requireCondition(typeof path === 'string' && path.length > 0
        && !/[\\:#?]/.test(path)
        && path.split('/').every(part => part && part !== '.' && part !== '..'),
    `Unsafe extension path: ${path}`);
}

export function readExtensionFiles(directory) {
    const files = {};
    function visit(relative = '') {
        for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
            const path = relative ? `${relative}/${entry.name}` : entry.name;
            requireSafePath(path);
            if (entry.isDirectory()) visit(path);
            else {
                requireCondition(entry.isFile(), `Unsupported build entry: ${path}`);
                files[path] = readFileSync(join(directory, path));
            }
        }
    }
    visit();
    return files;
}

export function validateExtension(files, { target, version }) {
    requireCondition(['chrome', 'firefox'].includes(target), `Unknown browser target: ${target}`);
    Object.keys(files).forEach(requireSafePath);
    requireCondition(Object.hasOwn(files, 'manifest.json'), 'manifest.json must be at the archive root');
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    requireCondition(manifest.manifest_version === 3, 'Expected Manifest V3');
    requireCondition(manifest.name === 'ASU ProfessorView', 'Unexpected extension name');
    requireCondition(manifest.version === version, 'Manifest version must match package.json');
    requireCondition(manifest.background?.type === 'module', 'Background must use module semantics');
    if (target === 'chrome') {
        requireCondition(typeof manifest.background.service_worker === 'string'
            && !manifest.background.scripts && !manifest.browser_specific_settings,
        'Chrome must use a service worker and the Chrome manifest');
    } else {
        requireCondition(Array.isArray(manifest.background.scripts) && manifest.background.scripts.length > 0
            && !manifest.background.service_worker && manifest.browser_specific_settings?.gecko?.id,
        'Firefox must use background scripts and declare its Gecko ID');
    }

    const referenced = new Set(['manifest.json']);
    const htmlPages = [];
    function requireFile(path) {
        requireSafePath(path);
        requireCondition(Object.hasOwn(files, path), `Missing referenced file: ${path}`);
        if (!referenced.has(path) && path.endsWith('.html')) htmlPages.push(path);
        referenced.add(path);
    }
    function requireClassicScript(path) {
        requireFile(path);
        // A content script cannot contain Vite's ESM imports/exports.
        new Script(new TextDecoder().decode(files[path]), { filename: path });
    }

    if (target === 'chrome') requireFile(manifest.background.service_worker);
    else manifest.background.scripts.forEach(requireFile);
    requireCondition(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0,
        'Missing content script declarations');
    for (const content of manifest.content_scripts) {
        requireCondition(Array.isArray(content.js) && content.js.length > 0, 'Missing content JavaScript');
        content.js.forEach(requireClassicScript);
        (content.css ?? []).forEach(requireFile);
    }
    requireFile(manifest.action?.default_popup);
    requireFile(manifest.options_page ?? manifest.options_ui?.page);
    Object.values(manifest.icons ?? {}).forEach(requireFile);

    for (const path of htmlPages) {
        const base = new URL(path, 'https://extension.invalid/');
        const dom = new JSDOM(new TextDecoder().decode(files[path]));
        try {
            const elements = dom.window.document.querySelectorAll('script[src], link[rel="stylesheet"][href], img[src], a[href]');
            for (const element of elements) {
                const reference = element.getAttribute(element.hasAttribute('src') ? 'src' : 'href');
                if (reference === '/' || reference.startsWith('#')) continue;
                const url = new URL(reference, base);
                if (url.origin !== base.origin) {
                    requireCondition(element.tagName !== 'SCRIPT', `Remote executable script in ${path}`);
                    continue;
                }
                const resource = decodeURIComponent(url.pathname.slice(1));
                if (element.tagName === 'SCRIPT' && element.getAttribute('type') !== 'module') requireClassicScript(resource);
                else requireFile(resource);
            }
        } finally {
            dom.window.close();
        }
    }
    for (const path of Object.keys(files)) {
        requireCondition(referenced.has(path), `Unexpected build file (not referenced): ${path}`);
    }
    return manifest;
}

export function createReleaseZip(files, options) {
    validateExtension(files, options);
    const entries = {};
    for (const path of Object.keys(files).sort()) {
        entries[path] = [files[path], { mtime: new Date(2000, 0, 1), level: 9 }];
    }
    const archive = zipSync(entries);
    const extracted = unzipSync(archive);
    validateExtension(extracted, options);
    for (const path of Object.keys(files)) {
        requireCondition(Buffer.from(files[path]).equals(Buffer.from(extracted[path])), `ZIP content changed: ${path}`);
    }
    return archive;
}
