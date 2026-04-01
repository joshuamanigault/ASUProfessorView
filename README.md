# ASU ProfessorView

**See Rate My Professor reviews directly in ASU Class Search**

A cross-browser extension that enhances the Arizona State University class catalog by displaying professor ratings and reviews from Rate My Professor right where you need them. Make informed decisions about your courses without leaving the ASU catalog.

![ASU ProfessorView Demo](https://github.com/user-attachments/assets/4f67c63b-aeab-4876-be88-0b264a0b1a5b)

---

## Download

<p align="left">
  <a href="https://chromewebstore.google.com/detail/asu-profview/kniajfafepienoohdheheofabfclpgnl">
    <img src="https://img.shields.io/badge/Download-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download for Chrome">
  </a>
  &nbsp;&nbsp;
  <a href="#firefox-add-ons">
    <img src="https://img.shields.io/badge/Download-Firefox-FF7139?style=for-the-badge&logo=firefox&logoColor=white" alt="Download for Firefox">
  </a>
</p>

> **Note:** Firefox Add-ons release coming soon. For now, see [Development Installation](#development-installation) to load the extension manually.

---

## Features

- **Instant Professor Ratings**: View ratings, difficulty scores, and reviews directly in the ASU course catalog
- **Smart Caching**: Intelligent data caching reduces API calls and improves performance
- **Customizable Display**: Choose between compact or detailed card views
- **Tag Insights**: See the top 5 most common student tags for each professor
- **Cross-Campus Support**: Searches across all ASU campuses (Tempe, Polytechnic, West)
- **Seamless Integration**: Works natively on ASU's catalog search pages
- **Cross-Browser**: Full support for Chrome and Firefox

---

## How It Works

1. Navigate to [ASU Class Search](https://catalog.apps.asu.edu/)
2. Browse courses as usual
3. Professor rating cards automatically appear next to instructor names
4. Click settings to customize your view preferences

No separate Rate My Professor searches needed!

---

## Installation

### Chrome Web Store

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/asu-profview/kniajfafepienoohdheheofabfclpgnl)
2. Click "Add to Chrome"
3. Navigate to ASU Class Search and refresh the page

### Firefox Add-ons

Coming soon to Firefox Add-ons (AMO). For now, see [Development Installation](#development-installation) below.

### Development Installation

For developers or users who want to install manually:

#### Prerequisites

- Node.js 16+ and npm
- Chrome or Firefox browser

#### Build from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/joshuamanigault/ASUProfessorView.git
   cd ASUProfessorView
   ```

2. **Install dependencies**
   ```bash
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

---

## Configuration

Click the extension icon in your browser toolbar and select "Settings" to customize:

- **Compact Cards**: Toggle between detailed and compact card views
- **Show Tags**: Display or hide the top 5 student tags for each professor

Settings sync across your browser sessions.

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
