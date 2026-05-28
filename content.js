// Global variables to track state across dynamic page transitions
let currentObserver = null;

// -------------------------
// Repo detection
// -------------------------
function getRepoInfo() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    
    // Repository home page has exactly 2 parts: /owner/repo
    if (parts.length !== 2) return null;

    // Filter out GitHub reserved keywords at the root level
    const reservedWords = new Set([
        "settings", "marketplace", "notifications", "explore", "topics",
        "trending", "collections", "search", "pulls", "issues", "sponsors",
        "about", "features", "security", "pricing", "login", "join",
        "orgs", "users", "help", "watching", "stars", "followers", "following"
    ]);

    if (reservedWords.has(parts[0].toLowerCase())) return null;

    return {
        owner: parts[0],
        repo: parts[1]
    };
}

// -------------------------
// DOM License Scraping (Fallback / Fast-path)
// -------------------------
function scrapeLicenseFromDOM() {
    const sidebar = document.querySelector(".Layout-sidebar");
    if (!sidebar) return null;

    // GitHub sidebar usually has links matching /LICENSE or /license under the About section
    const licenseLink = sidebar.querySelector(
        'a[href*="/LICENSE"], a[href*="/license"], a[href*="/LICENCE"], a[href*="/licence"]'
    );
    if (!licenseLink) return null;

    const text = licenseLink.innerText.trim();
    if (!text) return null;

    // Clean up text (e.g. "MIT License" -> "MIT")
    const cleanedText = text.replace(/\s+license/i, "").trim();

    return {
        name: text,
        spdx: mapTextToSpdx(cleanedText) || cleanedText
    };
}

function mapTextToSpdx(text) {
    const upper = text.toUpperCase();
    if (upper.includes("MIT")) return "MIT";
    if (upper.includes("APACHE")) return "Apache-2.0";
    if (upper.includes("BSD 3") || upper.includes("BSD-3")) return "BSD-3-Clause";
    if (upper.includes("BSD 2") || upper.includes("BSD-2")) return "BSD-2-Clause";
    if (upper.includes("ISC")) return "ISC";
    if (upper.includes("MPL 2") || upper.includes("MPL-2")) return "MPL-2.0";
    if (upper.includes("AGPL 3") || upper.includes("AGPL-3")) return "AGPL-3.0";
    if (upper.includes("GPL 3") || upper.includes("GPL-3")) return "GPL-3.0";
    if (upper.includes("GPL 2") || upper.includes("GPL-2")) return "GPL-2.0";
    if (upper.includes("LGPL 3") || upper.includes("LGPL-3")) return "LGPL-3.0";
    if (upper.includes("LGPL 2.1") || upper.includes("LGPL-2.1")) return "LGPL-2.1";
    if (upper.includes("LGPL 2") || upper.includes("LGPL-2")) return "LGPL-2.0";
    return null;
}

// -------------------------
// Communication with Background SW
// -------------------------
async function getLicenseDataFromBackground(owner, repo) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "GET_LICENSE_DATA", payload: { owner, repo } },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("[GLB] Service Worker fetch failed:", chrome.runtime.lastError);
                    resolve(null);
                } else if (response && response.success) {
                    resolve(response.data);
                } else {
                    resolve(null);
                }
            }
        );
    });
}

// -------------------------
// Normalize SPDX variants
// -------------------------
function normalizeLicense(spdx) {
    if (!spdx) return "UNKNOWN";

    return spdx
        .replace("-only", "")
        .replace("-or-later", "")
        .trim();
}

// -------------------------
// Detect complex licensing
// -------------------------
function detectComplexLicense(text) {
    if (!text) return false;

    const lower = text.toLowerCase();

    return (
        lower.includes("portions of this software") ||
        lower.includes("licensed as follows") ||
        lower.includes("third party") ||
        lower.includes("directory") ||
        lower.includes("except") ||
        lower.includes("separate license") ||
        lower.includes("/ee/")
    );
}

// -------------------------
// License categories and categorization mapping
// -------------------------
const LICENSE_CATEGORIES = {
    permissive: {
        allowed: ["Commercial use", "Modification", "Distribution", "Private use"],
        notAllowed: ["Remove license notice", "No warranty"]
    },
    weakCopyleft: {
        allowed: ["Commercial use", "Modification", "Distribution"],
        notAllowed: ["Must disclose modifications"]
    },
    strongCopyleft: {
        allowed: ["Use", "Modify"],
        notAllowed: ["Closed-source distribution"]
    },
    networkCopyleft: {
        allowed: ["Use", "Modify"],
        notAllowed: ["Must disclose source over network"]
    },
    proprietary: {
        allowed: [],
        notAllowed: ["All rights reserved"]
    }
};

const LICENSE_MAP = {
    "MIT": "permissive",
    "Apache-2.0": "permissive",
    "BSD-2-Clause": "permissive",
    "BSD-3-Clause": "permissive",
    "ISC": "permissive",

    "MPL-2.0": "weakCopyleft",
    "LGPL-2.1": "weakCopyleft",
    "LGPL-3.0": "weakCopyleft",

    "GPL-2.0": "strongCopyleft",
    "GPL-3.0": "strongCopyleft",

    "AGPL-3.0": "networkCopyleft"
};

// -------------------------
// UI Badge Generation
// -------------------------
function createBadge(licenseName, spdx, complexWarning = null) {
    const normalized = normalizeLicense(spdx);
    const category = LICENSE_MAP[normalized] || "proprietary";
    const info = LICENSE_CATEGORIES[category];

    const badge = document.createElement("div");
    badge.className = "glb-badge";

    const header = document.createElement("div");
    header.className = "glb-header";

    const title = document.createElement("div");
    title.className = "glb-title";
    title.textContent = `${licenseName} (${normalized})`;
    header.appendChild(title);
    badge.appendChild(header);

    // Render allowed section
    if (info.allowed.length > 0) {
        const allowedSec = document.createElement("div");
        allowedSec.className = "glb-section glb-allowed";
        
        const secTitle = document.createElement("div");
        secTitle.className = "glb-sec-title";
        secTitle.textContent = "Allowed";
        allowedSec.appendChild(secTitle);
        
        const ul = document.createElement("ul");
        info.allowed.forEach(item => {
            const li = document.createElement("li");
            li.textContent = `✓ ${item}`;
            ul.appendChild(li);
        });
        allowedSec.appendChild(ul);
        badge.appendChild(allowedSec);
    }

    // Render prohibited / conditions section
    if (info.notAllowed.length > 0) {
        const prohibitedSec = document.createElement("div");
        prohibitedSec.className = "glb-section glb-prohibited";
        
        const secTitle = document.createElement("div");
        secTitle.className = "glb-sec-title";
        secTitle.textContent = "Conditions / Prohibited";
        prohibitedSec.appendChild(secTitle);
        
        const ul = document.createElement("ul");
        info.notAllowed.forEach(item => {
            const li = document.createElement("li");
            li.textContent = `✗ ${item}`;
            ul.appendChild(li);
        });
        prohibitedSec.appendChild(ul);
        badge.appendChild(prohibitedSec);
    }

    // Render complex terms alert if detected
    if (complexWarning) {
        const alert = document.createElement("div");
        alert.className = "glb-alert";
        alert.textContent = `⚠ ${complexWarning}`;
        badge.appendChild(alert);
    }

    return badge;
}

// -------------------------
// Injection Manager
// -------------------------
function removeExistingBadges() {
    document.querySelectorAll(".glb-badge").forEach(el => el.remove());
}

function injectBadge(badge) {
    removeExistingBadges();

    const tryInject = () => {
        const sidebar = document.querySelector(".Layout-sidebar");
        if (!sidebar) return false;

        const aboutHeader = Array.from(sidebar.querySelectorAll("h2"))
            .find(h => h.innerText.trim() === "About");

        if (!aboutHeader) return false;

        const container = aboutHeader.parentElement;
        if (!container) return false;

        if (container.querySelector(".glb-badge")) return true;

        container.insertBefore(badge, aboutHeader);
        return true;
    };

    if (tryInject()) return;

    // Disconnect existing observer if any to prevent duplicates
    if (currentObserver) {
        currentObserver.disconnect();
    }

    currentObserver = new MutationObserver((mutations, obs) => {
        if (tryInject()) {
            obs.disconnect();
            currentObserver = null;
        }
    });

    currentObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// -------------------------
// Main orchestrator
// -------------------------
async function init() {
    console.log("[GLB] Orchestrator init");

    // Clean up any existing observer or badges
    if (currentObserver) {
        currentObserver.disconnect();
        currentObserver = null;
    }
    removeExistingBadges();

    const repo = getRepoInfo();
    if (!repo) {
        console.log("[GLB] Not on a valid repository homepage");
        return;
    }

    // Phase 1: Try instant DOM Scraping fast-path
    const scraped = scrapeLicenseFromDOM();
    let badge = null;
    let apiPromise = null;

    if (scraped) {
        console.log("[GLB] Fast-path DOM scrape successful:", scraped);
        badge = createBadge(scraped.name, scraped.spdx);
        injectBadge(badge);

        // Fetch API in the background asynchronously to inspect license content
        apiPromise = getLicenseDataFromBackground(repo.owner, repo.repo);
    } else {
        console.log("[GLB] Fast-path scrape failed, querying API...");
        apiPromise = getLicenseDataFromBackground(repo.owner, repo.repo);
    }

    // Phase 2: Resolve background fetch (cache/network)
    if (apiPromise) {
        apiPromise.then(data => {
            if (!data) {
                if (!scraped) {
                    console.warn("[GLB] No license details available from DOM or API.");
                    const errorBadge = document.createElement("div");
                    errorBadge.className = "glb-badge glb-no-license";
                    errorBadge.innerText = "NO LICENSE DATA";
                    injectBadge(errorBadge);
                }
                return;
            }

            console.log("[GLB] API retrieval completed:", data);
            
            // Check for complex licensing conditions
            const isComplex = detectComplexLicense(data.content);
            const complexWarning = isComplex 
                ? "Complex/multi-licensing clauses detected. Review the LICENSE file." 
                : null;

            // Re-render and replace badge with complete data
            const completeBadge = createBadge(data.name, data.spdx, complexWarning);
            injectBadge(completeBadge);
        });
    }
}

// -------------------------
// Navigation Event Handlers
// -------------------------
console.log("[GLB] Content script loaded");
init();

// Support GitHub's dynamic Turbo navigation framework
document.addEventListener("turbo:load", () => {
    console.log("[GLB] turbo:load fired");
    init();
});
document.addEventListener("turbo:render", () => {
    console.log("[GLB] turbo:render fired");
    init();
});

// Legacy PJAX fallback
document.addEventListener("pjax:end", () => {
    console.log("[GLB] pjax:end fired");
    init();
});