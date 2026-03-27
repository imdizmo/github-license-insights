// -------------------------
// Repo detection
// -------------------------
function getRepoInfo() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    return {
        owner: parts[0],
        repo: parts[1]
    };
}

// -------------------------
// GitHub API license fetch
// -------------------------
async function getLicenseData(owner, repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/license`);
        if (!res.ok) return null;

        const data = await res.json();

        return {
            name: data.license?.name || "UNKNOWN",
            spdx: data.license?.spdx_id || "UNKNOWN",
            content: atob(data.content || "") // decode base64 LICENSE
        };
    } catch {
        return null;
    }
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
// License categories
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

// -------------------------
// SPDX → category mapping
// -------------------------
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
// UI
// -------------------------
function createBadgeFromGitHub(data) {
    const normalized = normalizeLicense(data.spdx);
    const category = LICENSE_MAP[normalized] || "proprietary";
    const info = LICENSE_CATEGORIES[category];

    const badge = document.createElement("div");
    badge.className = "glb-badge";

    const title = document.createElement("div");
    title.className = "glb-title";
    title.textContent = `${data.name} (${normalized})`;

    const allowed = document.createElement("div");
    const allowedStrong = document.createElement("strong");
    allowedStrong.textContent = "Allowed: ";
    allowed.appendChild(allowedStrong);
    allowed.appendChild(
        document.createTextNode(info.allowed.join(", ") || "Unknown")
    );

    const notAllowed = document.createElement("div");
    const notAllowedStrong = document.createElement("strong");
    notAllowedStrong.textContent = "Not allowed: ";
    notAllowed.appendChild(notAllowedStrong);
    notAllowed.appendChild(
        document.createTextNode(info.notAllowed.join(", ") || "Unknown")
    );

    badge.appendChild(title);
    badge.appendChild(allowed);
    badge.appendChild(notAllowed);

    return badge;
}

// -------------------------
// Inject
// -------------------------
function injectBadge(badge) {
    const tryInject = () => {
        const aboutHeader = Array.from(document.querySelectorAll("h2"))
            .find(h => h.innerText.trim() === "About");

        if (!aboutHeader) return false;

        const container = aboutHeader.parentElement;
        if (!container) return false;

        if (container.querySelector(".glb-badge")) return true;

        container.insertBefore(badge, aboutHeader);
        return true;
    };

    if (tryInject()) return;

    const observer = new MutationObserver(() => {
        if (tryInject()) observer.disconnect();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// -------------------------
// Main
// -------------------------
async function init() {
    console.log("[GLB] init");

    const repo = getRepoInfo();
    console.log("[GLB] repo:", repo);

    if (!repo) return;

    const data = await getLicenseData(repo.owner, repo.repo);
    console.log("[GLB] license data:", data);

    if (!data) {
        console.warn("[GLB] no license data");

        const badge = document.createElement("div");
        badge.className = "glb-badge";
        badge.innerText = "NO LICENSE DATA";
        injectBadge(badge);

        return;
    }

    const badge = createBadgeFromGitHub(data);
    injectBadge(badge);
}

init();