const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Helper to parse .env file if it exists (mirrors publish-firefox.js)
function loadEnv() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return {};

    const env = {};
    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach(line => {
        if (line.trim().startsWith("#") || !line.trim()) return;
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] ? match[2].trim() : "";
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            env[match[1]] = value;
        }
    });
    return env;
}

function publish() {
    const isDryRun = process.argv.slice(2).includes("--dry-run");
    console.log("Starting Chrome Web Store upload/publish process...");

    // Local .env merged with process.env (for CI/CD compatibility)
    const localEnv = loadEnv();
    const get = (k) => localEnv[k] || process.env[k];
    const extensionId  = get("CHROME_EXTENSION_ID");
    const clientId     = get("CHROME_CLIENT_ID");
    const clientSecret = get("CHROME_CLIENT_SECRET");
    const refreshToken = get("CHROME_REFRESH_TOKEN");

    const zip = path.join(__dirname, "github-license-insights-chrome.zip");
    if (!fs.existsSync(zip)) {
        console.error("❌ github-license-insights-chrome.zip not found. Run 'npm run build' first.");
        process.exit(1);
    }

    const missing = [];
    if (!extensionId)  missing.push("CHROME_EXTENSION_ID");
    if (!clientId)     missing.push("CHROME_CLIENT_ID");
    if (!clientSecret) missing.push("CHROME_CLIENT_SECRET");
    if (!refreshToken) missing.push("CHROME_REFRESH_TOKEN");

    if (isDryRun) {
        console.log(`[Dry Run] Package ready: ${path.basename(zip)}`);
        console.log(`[Dry Run] Extension ID: ${extensionId || "(unset)"}`);
        if (missing.length) console.log(`[Dry Run] Still missing creds: ${missing.join(", ")}`);
        else console.log("[Dry Run] All credentials present — ready to publish.");
        return;
    }

    if (missing.length) {
        console.error(`❌ Missing Chrome Web Store credentials: ${missing.join(", ")}`);
        console.error("Define them in .env or the environment. See CHROMEWEBSTORE.md for setup.");
        process.exit(1);
    }

    try {
        console.log("Invoking chrome-webstore-upload-cli (upload + auto-publish)...");
        const cmd = `npx -y chrome-webstore-upload-cli@3 upload ` +
            `--source "${zip}" ` +
            `--extension-id "${extensionId}" ` +
            `--client-id "${clientId}" ` +
            `--client-secret "${clientSecret}" ` +
            `--refresh-token "${refreshToken}" ` +
            `--auto-publish`;
        execSync(cmd, { stdio: "inherit" });
        console.log("\n✓ Chrome extension uploaded and submitted for publishing!");
        console.log("Note: Chrome Web Store review can take hours to days before it goes live.");
    } catch (error) {
        console.error("\n❌ Failed during Chrome Web Store upload.");
        console.error(error.message);
        process.exit(1);
    }
}

publish();
