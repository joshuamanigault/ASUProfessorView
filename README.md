<p align="center">
  <img src="docs/assets/logo.png" alt="ASU ProfessorView logo: a gold graduation cap above an eye on a maroon background" width="180" height="180">
</p>

<h1 align="center">ASU ProfessorView</h1>

<p align="center">
  <strong>See Rate My Professor reviews directly in ASU Class Search</strong>
</p>

<p align="center">
  <a href="https://github.com/joshuamanigault/ASUProfessorView/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/joshuamanigault/ASUProfessorView/ci.yml?branch=main&amp;event=push&amp;label=CI&amp;logo=github" alt="CI status on main">
  </a>
  <a href="https://github.com/joshuamanigault/ASUProfessorView/releases/latest">
    <img src="https://img.shields.io/github/v/release/joshuamanigault/ASUProfessorView?label=latest%20release&amp;color=blue" alt="Latest release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  </a>
</p>

A cross-browser extension that enhances the Arizona State University class catalog by displaying professor ratings and reviews from Rate My Professor right where you need them. Make informed decisions about your courses without leaving the ASU catalog.

![ASU ProfessorView Demo](https://github.com/user-attachments/assets/4f67c63b-aeab-4876-be88-0b264a0b1a5b)

---

## Download

<p align="left">
  <a href="https://chromewebstore.google.com/detail/asu-profview/kniajfafepienoohdheheofabfclpgnl">
    <img src="https://img.shields.io/badge/Download-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download for Chrome">
  </a>
  &nbsp;&nbsp;
  <a href="https://addons.mozilla.org/en-US/firefox/addon/asu-professorview/">
    <img src="https://img.shields.io/badge/Download-Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white" alt="Download for Firefox">
  </a>
</p>

---

## Features

- **Instant Professor Ratings**: View ratings, difficulty scores, and reviews directly in the ASU course catalog
- **Smart Caching**: Intelligent data caching reduces API calls and improves performance
- **Customizable Display**: Choose between compact or detailed card views
- **Tag Insights**: See the top 5 most common student tags for each professor
- **Copy Class Numbers**: Copy a class's numeric registration number from any professor card
- **Cross-Campus Support**: Searches across all ASU campuses (Tempe, Polytechnic, West)
- **Seamless Integration**: Works natively on ASU's catalog search pages
- **Cross-Browser**: Full support for Chrome and Firefox

---

## How It Works

1. Navigate to [ASU Class Search](https://catalog.apps.asu.edu/)
2. Browse courses as usual
3. Professor rating cards automatically appear next to instructor names
4. Click settings to customize your view preferences
5. Use the copy button on a professor card to copy that result's numeric Class # for registration

No separate Rate My Professor searches needed!

---

## Installation

### Chrome Web Store

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/asu-profview/kniajfafepienoohdheheofabfclpgnl)
2. Click "Add to Chrome"
3. Navigate to ASU's Class Search and refresh the page

### Firefox Add-ons

1. Visit the [Firefox Add-Ons Browser](https://addons.mozilla.org/en-US/firefox/addon/asu-professorview/)
2. Click "Add to Firefox"
3. Navigate to ASU's Class Search and refresh the page

### Development Installation

For developers or users who want to install manually:

#### Prerequisites

- Node.js 20.19+ or 22.12+ and npm (Vite's supported versions)
- Chrome or Firefox browser

#### Build from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/joshuamanigault/ASUProfessorView.git
   cd ASUProfessorView
   ```

2. **Install dependencies**
   ```bash
   npm ci
   # or 
   npm install
   ```

3. **Build the extension**
   
   For Chrome:
   ```bash
   npm run build:chrome
   ```
   
   For Firefox:
   ```bash
   npm run build:firefox
   ```
   
   Or build both:
   ```bash
   npm run build
   ```

4. **Load the extension**

   **Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist-chrome/` folder

   **Firefox:**
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Navigate to `dist-firefox/` and select `manifest.json`

5. **Test it out**
   - Go to [ASU Class Search](https://catalog.apps.asu.edu/)
   - Refresh the page
   - Rating cards should appear next to professor names

#### Validation and Release Packages

```bash
npm test                   # Background, settings/popup, card behavior, safety, packaging
npm run typecheck          # TypeScript checks
npm run check              # Lint, types, tests, both builds, bundle checks, Firefox lint
npm run package            # All checks, then validated release ZIPs
```

Release ZIPs are written to `artifacts/asu-professorview-chrome-<version>.zip` and
`artifacts/asu-professorview-firefox-<version>.zip`. Each archive has `manifest.json`
at its root, fixed entry timestamps, and the referenced build files only. Packaging
checks both manifest versions against `package.json` and verifies every ZIP entry
after extracting it in memory. It does not sign, upload, or publish the extension.
The shipped content bundles also run against a mocked ASU page in jsdom to verify
that styles and all instructor cards survive production bundling. A second smoke
check connects the shipped settings, content, background, and popup scripts using
browser API doubles and RMP HTTP fixtures, exercising the actual bundled RMP parser.

See the [test and CI audit](docs/testing-audit.md) for coverage boundaries,
fault-injection evidence, and remaining production checks. CI provides an aggregate
`CI gate` check; require it in the main-branch protection rule to block merges when
any validation fails, is cancelled, or is skipped.

Before a store release, update the version in `package.json`, the lockfile, and
both source manifests together. Load each built extension and test an ASU result with multiple
instructors at desktop and mobile widths, change searches while requests are
pending, and check compact cards, tags, settings, and Clear Cache. Automated DOM
tests do not replace this browser smoke test or a live RMP lookup.

Current checks pass with warnings: the RMP dependency includes Node-only `fs`
helpers that Vite cannot bundle for browsers; Mozilla's linter reports four parser
warnings in the minified background bundle and one dynamic `innerHTML` warning
in the content bundle. Hostile template values are covered by regression tests.
The RMP adapter and further response validation remain Phase 2 work.


---

## Configuration

Click the extension icon in your browser toolbar and select "Settings" to customize:

- **Compact Cards**: Toggle between detailed and compact card views
- **Show Tags**: Display or hide the top 5 student tags for each professor
- **Show 'Copy class number' button**: Show or hide the copy action in normal and compact cards (enabled by default). Copies only the numeric Class #, such as `15448`, including when professor ratings are unavailable.

Settings sync across your browser sessions.

Reload Class Search after changing settings. The copy button reads the class number
from its current result row when clicked and briefly shows "Copied!" after a successful
copy. If copying fails, the card displays an error and allows another attempt.

---


## Privacy

ASU ProfessorView respects your privacy:

- No personal data collection
- No tracking or analytics
- No third-party data sharing
- Data fetched directly from Rate My Professor API
- Settings stored locally in your browser

---

## Support

For questions, issues, or feedback:

- **GitHub Issues**: [Report a bug or request a feature](https://github.com/joshuamanigault/ASUProfessorView/issues)
- **Email**: n.joshuamanigault@gmail.com

---

<p align="center">
  Made with care for ASU students
  <br>
  <a href="https://github.com/joshuamanigault/ASUProfessorView">⭐ Star this repo if you find it helpful!</a>
</p>
