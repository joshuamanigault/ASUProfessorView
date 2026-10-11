import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readExtensionFiles, validateExtension } from './extension-package.mjs';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
for (const target of ['chrome', 'firefox']) {
    const files = readExtensionFiles(fileURLToPath(new URL(`dist-${target}/`, root)));
    validateExtension(files, { target, version });
    console.log(`${target}: manifest, classic scripts, and ${Object.keys(files).length} release files validated`);
}
