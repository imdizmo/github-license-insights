# GitHub License Insights

Shows a simple summary of repository licenses directly on GitHub pages.

## Features

- **Instant DOM-Scraping Fallback**: Instantly parses and displays the license from the sidebar, with zero network delay.
- **Service Worker Caching**: Fetches license data via an MV3 background service worker, caching responses in `chrome.storage.local` to optimize API limits.
- **Complex License Scanning**: Scans license file text for complex, multi-licensing, or custom exception clauses.
- **Theme-Adaptive UI**: Matches GitHub's native style variables, supporting Light, Dark, and Dimmed modes dynamically.
- **Dynamic Routing Support**: Seamlessly updates when navigating across repositories via GitHub's client-side Turbo/PJAX system.

## Local Development & Testing

### Installation

#### Firefox (AMO Developer Debugging)
1. Open Firefox and navigate to `about:debugging`.
2. Click **This Firefox** on the left menu.
3. Click **Load Temporary Add-on...**.
4. Select the `manifest.json` file inside the repository directory.

#### Chrome / Chromium
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** in the top left.
4. Select the repository directory.

### Automated Tests
This project uses Playwright to test the extension behavior on mocked pages. Run:
```bash
npm install
npx playwright install chromium
npm test
```

## Production Build
To package the extension for deployment on Firefox Add-ons (AMO) or Chrome Web Store, use the zipped archive:
```bash
zip -r github-license-insights.zip manifest.json background.js content.js styles.css icons/ LICENSE README.md screenshots/
```

## Screenshots

![License Badge](./screenshots/feature_highlight.png)