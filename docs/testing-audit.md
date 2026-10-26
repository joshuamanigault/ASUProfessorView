# Test and CI audit

Audited on October 26, 2026, starting from `fa3abd8` on `refactor/automated-tests`.

## Verdict

The suite contains valuable behavior tests, but the original green CI result was
not sufficient evidence that the extension's core lookup flow worked. Its source
tests never executed the background entry point, options page, or popup, and its
production smoke test supplied successful responses without running the background.
The audit reproduced a real cache-read failure that those checks missed.

Those gaps are now covered, redundant cases have been reduced, and local packaging
runs the same checks as CI. This is a stronger automated regression baseline, not
a guarantee that every production failure is detected. Repository enforcement and
real-browser/live-service verification remain necessary before relying on it as
the sole production gate.

## Findings and changes

| Risk | Audit result |
| --- | --- |
| Fetching, campus/name matching, persistent cache, and cleanup were untested | Added tests through the actual background message and alarm listeners. They cover supported campus/name fallbacks, rejection of unrelated professors, cache hits and expiry boundaries, upstream failures and retry, tags, cleanup, and cache clearing. Only browser storage/alarms and the external provider boundary are substituted. |
| A cache read or expired-entry removal error prevented a valid lookup | Reproduced with a failing test, then fixed. Cache reads and writes can fail without discarding available professor data. |
| Settings and popup could break while the content tests stayed green | Added tests using the actual HTML and entry scripts: defaults, saved preferences, independent mouse/keyboard updates, reload persistence, and clear-cache success/rejection/transport feedback. |
| Cards could display fabricated ratings without failing existing tests | Added checks for supplied rating/difficulty values, review counts, department, and missing-data fallbacks in both layouts. The production check also verifies parsed rating values. |
| Mocked content responses concealed background/bundling failures | Added a connected smoke check for both shipped builds. It runs the real bundled RMP dependency with HTTP fixtures, plus settings, content, background messages, persistent cache, clipboard actions, and popup clearing. |
| Test breadth was inflated by repeated option combinations | Reduced eight DOM integration combinations to two storage-wiring cases. Kept exhaustive template variant checks, security cases, stale-response tests, concurrency control, and clipboard failure/retry behavior. Removed a duplicate option test and incidental assertions about log counts and DOM placement. |
| Observer checks depended on fixed 300 ms sleeps | Use bounded polling for observable updates and a fake clock for the self-mutation check. |
| Local `check` did not run lint; PR CI did not create actual release ZIPs | `check` now includes lint and both production smoke checks. PR CI also packages the actual downloaded builds. The release workflow uses the same validation path. |
| Depending on a skipped downstream job could conceal an earlier failed check | Added an always-running `CI gate` that requires every dependency to succeed, plus merge-queue triggers and job time limits. |

The existing package tests were retained: deterministic ZIPs, byte preservation,
manifest/browser/version checks, missing resources, unsafe paths, unexpected source
files, and accidental ESM content scripts all address meaningful shipping risks.

## Evidence that assertions detect faults

During this audit, each fault below was introduced separately into the real source,
the relevant tests were run, and the original bytes were restored in a `finally`
block. All nine mutations caused assertion failures:

- Accepting an unrelated professor's name.
- Returning expired cache data.
- Making cache clearing a no-op.
- Copying a fixed, incorrect class number.
- Accepting a stale instructor reply before the observer rescans.
- Inserting untrusted template values as HTML.
- Writing an extra preference when changing one setting.
- Allowing a missing referenced package resource.
- Hardcoding a rating instead of displaying the provider's value.

This is a targeted fault audit, not a comprehensive mutation score. The temporary
drivers and evidence logs remain in ignored `artifacts/`; they are not extra CI
infrastructure. The actual gate script was also exercised against 24 dependency
result combinations: successes passed; failures, cancellations, and skips failed.

## Validation

`npm run package` passes locally on Node 22.14.0 with 33 tests, no failures or
skips, both production builds, both smoke checks, extension validation, Firefox
lint, and both release ZIPs. Both workflow files parse as YAML. The updated
workflows have not run on GitHub yet; CI uses Node 24 on Linux.

An exploratory coverage run reported 95.48% lines and 91.62% branches for the three
imported content modules. That figure excludes the background, pages, and content
entry point in this runner, including scripts executed in VM/jsdom contexts. It
must not be presented as repository-wide coverage or used as proof of completeness.
No arbitrary coverage threshold was added.

The previous main-branch [CI run](https://github.com/joshuamanigault/ASUProfessorView/actions/runs/40023225651)
and [release run](https://github.com/joshuamanigault/ASUProfessorView/actions/runs/40023834333)
were successful; they exercised the older suite, not these changes.

## Remaining production boundaries

1. **Merge enforcement is absent.** The [GitHub branch API](https://api.github.com/repos/joshuamanigault/ASUProfessorView/branches/main) reported `main` as
   `protected: false`, required-check enforcement `off`, no required contexts, and
   [no repository rulesets](https://api.github.com/repos/joshuamanigault/ASUProfessorView/rulesets) at the time of the audit. After these changes are pushed
   and the new check has run, configure an active main-branch rule requiring pull
   requests and `CI gate`, with an up-to-date tested merge result and appropriate
   bypass restrictions. No remote settings were changed during this audit.
   [GitHub documents why skipped dependency checks need special handling.](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
2. **Browser APIs are simulated.** jsdom/VM checks do not prove extension loading,
   permissions, CSP enforcement, real clipboard activation, responsive rendering,
   or service-worker suspension/restart in Chrome and Firefox. A small browser
   integration suite would be a valuable next layer. Until then, load each actual
   build before release and check a multiple-instructor result at desktop/mobile
   widths, changing searches while requests are pending, settings, copy, and Clear
   Cache.
3. **External changes cannot be caught by fixed fixtures alone.** A live ASU DOM
   change or RMP schema/authentication/availability change can invalidate the
   assumptions in a passing deterministic suite. Perform a live lookup in each
   browser before release and refresh fixtures when those contracts change. Live
   third-party calls are deliberately not a required PR check.
4. **Existing tool warnings remain visible.** Vite warns about unused Node `fs`
   helpers in the RMP package. Firefox lint reports zero errors and five warnings:
   four background parser warnings and one dynamic `innerHTML` warning. Hostile
   string rendering is tested, and the exercised bundled lookup path works, but
   those checks do not certify every dependency method or every possible payload.
   Warning growth currently does not fail CI.

## Keeping tests valuable

Add tests for observable user outcomes, data integrity, security boundaries,
concurrency, and failure recovery. Give each regression a credible failure it would
catch. Assert returned/displayed values and side effects rather than private helper
structure, exact logs, styling tokens, or incidental markup. Cover permutations at
the cheapest layer and use a few integration scenarios to prove the layers connect.
Avoid whole-page snapshots, tests that copy implementation logic, and coverage
targets that encourage trivial assertions. Change fixtures when the external
contract changes, and demonstrate a failing case before fixing a newly found bug.
