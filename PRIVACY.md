# Privacy Policy for GitHub License Insights

Last Updated: 2026-05-28

Your privacy is important to us. This privacy policy explains how **GitHub License Insights** handles your information.

## 1. No Data Collection
GitHub License Insights is designed to be local-first. 
* **We do not collect** any personally identifiable information (PII).
* **We do not track** your browsing history, cookies, or user sessions.
* **We do not monitor** your activity outside of displaying license insights on GitHub repository homepages.

## 2. Local Storage & Caching
The extension uses the browser's local storage API (`chrome.storage.local`) to cache repository license details (such as the license name and content) for up to 24 hours. 
* This data is stored **entirely on your local device**.
* The cache is only used to prevent redundant requests to the public GitHub API and to avoid rate-limiting.
* The data is never sent to us or any third parties, and it is cleared automatically or when you uninstall the extension.

## 3. Network Requests
To fetch license information, the extension communicates directly with the public GitHub API (`https://api.github.com`). 
* These requests are made directly from your browser to GitHub.
* No intermediate servers are used, and no headers or credentials representing you are sent with the unauthenticated API requests.

## 4. No Third-Party Sharing
We do not sell, rent, trade, or share any data with third parties.

## 5. Contact
If you have any questions about this privacy policy or the extension, please open an issue on our [GitHub repository](https://github.com/imdizmo/github-license-insights/issues).
