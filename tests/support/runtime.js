import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual entry point, replacing only browser and external API boundaries.
// Type checking remains a separate gate; transpilation here changes no application logic.
export function sourceScript(path) {
    const source = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
    return ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
}

export function runSource(path, globals) {
    return runInNewContext(sourceScript(path), globals, { filename: `src/${path}` });
}
