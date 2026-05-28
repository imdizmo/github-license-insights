const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

function build() {
    const manifestPath = path.join(__dirname, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
        console.error("manifest.json not found!");
        process.exit(1);
    }

    const originalManifest = fs.readFileSync(manifestPath, "utf8");
    const manifestObj = JSON.parse(originalManifest);

    // 1. Build Firefox Zip (requires background.scripts fallback)
    console.log("Packaging Firefox extension...");
    try {
        execSync("zip -r github-license-insights-firefox.zip manifest.json background.js content.js styles.css icons/ LICENSE README.md screenshots/");
        console.log("✓ Created github-license-insights-firefox.zip");
    } catch (e) {
        console.error("Failed to build Firefox zip:", e.message);
    }

    // 2. Build Chrome Zip (requires background.service_worker ONLY)
    console.log("Packaging Chrome extension...");
    if (manifestObj.background && manifestObj.background.scripts) {
        delete manifestObj.background.scripts;
    }
    
    // Write Chrome-specific manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 4), "utf8");

    try {
        execSync("zip -r github-license-insights-chrome.zip manifest.json background.js content.js styles.css icons/ LICENSE README.md screenshots/");
        console.log("✓ Created github-license-insights-chrome.zip");
    } catch (e) {
        console.error("Failed to build Chrome zip:", e.message);
    } finally {
        // Restore original manifest for local development/git
        fs.writeFileSync(manifestPath, originalManifest, "utf8");
        console.log("Restored original manifest.json");
    }

    console.log("Build processes completed.");
}

build();
