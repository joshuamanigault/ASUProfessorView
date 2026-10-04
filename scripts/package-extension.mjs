import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createReleaseZip, readExtensionFiles } from './extension-package.mjs';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
mkdirSync(new URL('artifacts/', root), { recursive: true });
for (const target of ['chrome', 'firefox']) {
    const files = readExtensionFiles(fileURLToPath(new URL(`dist-${target}/`, root)));
    const archive = createReleaseZip(files, { target, version });
    const filename = `artifacts/asu-professorview-${target}-${version}.zip`;
    writeFileSync(new URL(filename, root), archive);
    console.log(`${filename}: ${archive.length} bytes, manifest.json at root`);
}
