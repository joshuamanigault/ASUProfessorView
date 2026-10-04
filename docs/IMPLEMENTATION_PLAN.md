# Audit implementation plan

This plan preserves the audit's five phases. Phase 1 is implemented and has passed
automated validation. Later phases remain separate increments, with tests focused
on the failure scenarios each change addresses.

## Phase 1 — Critical fixes

| Task | Status | Files | Reason and validation |
| --- | --- | --- | --- |
| Render every linked instructor, outside ASU's responsive name spans | Implemented | `src/Content/content.js`, `professor-cards.js`, `content.styles.css` | Prevents omitted instructors and cards hidden with desktop-only names. DOM fixtures cover multiple instructors, duplicate responsive links, unchanged ASU names, late responses, dynamic rows, and concurrency limits. |
| Validate RMP legacy IDs before rendering links | Implemented | `src/Content/templates.js` | Prevents IDs from injecting attributes or markup. Both layouts accept only positive safe integer IDs; hostile IDs, names, departments, counts, and tags are tested. |
| Validate and package Chrome and Firefox releases | Implemented | `scripts/`, `vite.config.ts`, `package.json`, `.gitignore`, `tests/extension-package.test.js` | Root manifests, browser-specific background declarations, matching versions, referenced files, classic script syntax, fixed ZIP timestamps, and extracted file bytes are checked. Missing assets, manifest swaps, nested manifests, extra source files, and unsafe paths are rejected. |
| Remediate vulnerable build dependencies | Implemented | `package.json`, `package-lock.json` | Vite and affected transitive dependencies are updated. Mozilla's standalone add-on linter avoids the Android tooling dependency in web-ext. Full `npm audit` reports zero vulnerabilities as of this implementation. |
| Installed-browser smoke test | Pending before publication | `dist-chrome/`, `dist-firefox/` | Test live lookups, multiple instructors at desktop/mobile widths, changing searches during requests, both card layouts, tags, settings, and Clear Cache in each browser. jsdom verifies DOM structure, not browser layout or live API availability. |

Risk: medium for DOM behavior; low for the constrained ID validation and packaging
changes. Packaging follows successful builds, type checks, regression tests,
shipped-bundle smoke checks in jsdom, and Firefox lint. No signing, store
submission, or publication occurs in this phase.

The existing `rate-my-professor-api-ts` dependency still produces Vite warnings
about Node-only `fs.writeFile` helpers. Firefox lint has zero errors and five
warnings: four unsupported-callee parser warnings in the minified background
bundle and one dynamic `innerHTML` warning in the content bundle. Template input
safety has regression coverage, but these warnings remain visible and must be
reassessed as the API adapter and response validation are improved.

## Phase 2 — Reliability

| Task | Files likely affected | Change and reason | Risk / dependencies | Verification |
| --- | --- | --- | --- | --- |
| Separate missing professors from transient failures | `src/Background/background.ts`, `src/Content/professor-cards.js`, `templates.js` | Introduce a validated request/response contract with distinct found, not-found, and error outcomes. Network or API failures currently become a not-found card. Add bounded request timeouts and an appropriate retry path. | Medium; establish contract before changing UI states | Mock no match, timeout, rejected request, malformed response, invalid extension context, and successful retry. |
| Match tags to the selected professor | Background and an RMP adapter | Retain the selected professor ID and use it for comments/tags instead of performing a second name-based match. The existing local campus fix improves campus consistency but does not establish identity consistency. | Medium; inspect the dependency's actual query API first | Same-name professors, alternate campuses, name variations, and tag-query failures. |
| Make cache failures nonfatal | Background/cache module | Validate cache envelopes, treat failed reads and malformed entries as misses, and restrict clearing/cleanup to professor-cache keys. Prevent an in-flight request from repopulating cleared data. | Medium; use the typed result contract | Corrupt expiry/value, storage read/write/remove failures, expiry boundaries, unrelated keys, and clear-versus-pending-write races. |
| Verify the RMP browser adapter | Background and adapter tests | Isolate the methods used by the extension and confirm that their browser execution avoids Node file helpers. Reassess whether a browser-native adapter is needed based on concrete failures. | Medium; follow API tracing, no speculative rewrite | Successful lookup/comments using mocked fetch, service errors, empty results, and a live smoke test in each browser. |

## Phase 3 — Architecture

| Task | Files likely affected | Change and reason | Risk / dependencies | Verification |
| --- | --- | --- | --- | --- |
| Separate lookup, cache, and message handling | `src/Background/` | Extract small modules around the Phase 2 boundaries so each can be tested without booting extension listeners. Keep the message listener and alarm setup thin. | Medium; Phase 2 behavior and tests first | Run the same behavioral tests against extracted modules and both browser builds. |
| Share typed contracts and constants | Background, content, options, popup | Centralize message discriminants and preference defaults to prevent drift across contexts. Extend type checking where it protects these contracts. | Low–medium; validated Phase 2 contract | Compile consumers and test default preferences and unsupported requests. |
| Reduce fragile template duplication | `src/Content/templates.js` | Share the common data formatting and safe link/tag creation used by both layouts without flattening their different markup. | Low; retain Phase 1 hostile-input coverage | Check full/compact found, missing, and error cards with null/zero/malformed fields. |

## Phase 4 — Performance

| Task | Files likely affected | Change and reason | Risk / dependencies | Verification |
| --- | --- | --- | --- | --- |
| Fetch tags only when requested | Content message contract, background, adapter/cache | Avoid fetching comments when Show Tags is disabled. Cache ratings and tag enrichment separately as needed, so enabling tags can enrich a previously cached rating. | Medium; selected-ID queries and cache contract first | Assert request counts with tags disabled/enabled and after changing preferences. |
| Coalesce background lookups | Background lookup/cache | Share pending work across tabs. Phase 1 coalesces requests only within one content-script instance. | Medium; failure semantics and clear-cache races first | Concurrent same-name requests across senders, failed-work cleanup, and clearing during a lookup. |
| Remove redundant search work | RMP adapter/search logic | Deduplicate name variants and reuse verified school/professor IDs where supported. Measure calls before changing parallelism or cache lifetime. | Low–medium; adapter tests first | Assert exact request counts while preserving alternate-campus and name-variation results. |

Selective mutation observation and pending-request coalescing within a page were
implemented with the Phase 1 DOM fix because they prevent self-triggered scans
and stale destination state. Do not repeat that refactor in this phase.

## Phase 5 — Cleanup

| Task | Files likely affected | Change and reason | Risk / dependencies | Verification |
| --- | --- | --- | --- | --- |
| Repair development commands and document boundaries | `package.json`, `README.md` | Replace the current `dev` command, which references missing `src/rmp-api.ts`, with a documented extension development workflow. Explain content/background/storage boundaries and release prerequisites. | Low; finalized build workflow | Run every documented command from a clean install. |
| Align privacy copy and font loading | README, popup/options CSS | Reconcile sync preference storage and external Google Fonts requests with the privacy claims. Prefer a local/system font if remote fetching is unnecessary. | Low; no runtime refactor required | Inspect extension-page network requests and verify rendering without external fonts. |
| Improve settings accessibility and failure feedback | Options and popup | Review checkbox keyboard behavior and communicate storage/cache-clear failures where users can act on them. | Low; reuse Phase 2 result contracts where applicable | Keyboard activation, focus, stored defaults, and failure cases. |
| Finish narrowly scoped cleanup | Existing source files | Remove confirmed obsolete code and resolve remaining inconsistencies when touched. The unused not-found icon rule, redundant copied content assets, and name-normalization duplication were already addressed in earlier commits. | Low; avoid broad formatting changes | Type checks, regression tests, and builds remain passing. |

## Validation commands

- `npm ci` installs the locked development and production dependencies.
- `npm test` runs the instructor, template-security, and packaging regression tests.
- `npm run typecheck` checks TypeScript sources.
- `npm run check` runs type checks, tests, both builds, artifact validation, shipped-content smoke checks, and Firefox lint.
- `npm run package` runs all checks and writes both validated ZIPs under `artifacts/`.
- `npm audit` checks the full installed dependency tree for known advisories.

Release versions remain at `1.3.3` until a release is prepared. A release version
must be updated in `package.json`, the lockfile, and both source manifests.
