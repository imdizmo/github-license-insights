const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Helper to parse .env file if it exists
function loadEnv() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return {};

    const env = {};
    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach(line => {
        // Skip comments and empty lines
        if (line.trim().startsWith("#") || !line.trim()) return;
        
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] ? match[2].trim() : "";
            // Strip quotes if present
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
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");

    console.log("Starting Firefox extension signing/publishing process...");
    
    // Load local .env values and merge with process.env for CI/CD compatibility
    const localEnv = loadEnv();
    const apiKey = localEnv.FIREFOX_API_KEY || localEnv.WEB_EXT_API_KEY || process.env.FIREFOX_API_KEY || process.env.WEB_EXT_API_KEY;
    const apiSecret = localEnv.FIREFOX_API_SECRET || localEnv.WEB_EXT_API_SECRET || process.env.FIREFOX_API_SECRET || process.env.WEB_EXT_API_SECRET;
    const channel = localEnv.FIREFOX_CHANNEL || localEnv.WEB_EXT_CHANNEL || process.env.FIREFOX_CHANNEL || process.env.WEB_EXT_CHANNEL || "listed";

    if (!isDryRun && (!apiKey || !apiSecret)) {
        console.error("❌ Error: Missing Firefox Add-ons API credentials.");
        console.error("Please define FIREFOX_API_KEY (or WEB_EXT_API_KEY) and FIREFOX_API_SECRET (or WEB_EXT_API_SECRET)");
        console.error("in your .env file or environment variables.");
        process.exit(1);
    }

    const distDir = path.join(__dirname, "dist-firefox");
    console.log(`Creating temporary workspace: ${distDir}`);
    
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir);

    // List of files to copy
    const filesToCopy = ["manifest.json", "background.js", "content.js", "styles.css", "LICENSE", "README.md"];
    const dirsToCopy = ["icons", "screenshots"];

    // Copy files
    filesToCopy.forEach(file => {
        const srcPath = path.join(__dirname, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, path.join(distDir, file));
            console.log(`  Copied file: ${file}`);
        }
    });

    // Copy directories
    dirsToCopy.forEach(dir => {
        const srcDirPath = path.join(__dirname, dir);
        if (fs.existsSync(srcDirPath)) {
            const destDirPath = path.join(distDir, dir);
            fs.mkdirSync(destDirPath);
            fs.readdirSync(srcDirPath).forEach(file => {
                fs.copyFileSync(path.join(srcDirPath, file), path.join(destDirPath, file));
            });
            console.log(`  Copied directory: ${dir}/`);
        }
    });

    if (isDryRun) {
        console.log("\n[Dry Run] Firefox build workspace generated successfully.");
        console.log(`[Dry Run] Target signing channel: ${channel}`);
        console.log("[Dry Run] Running clean up...");
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log("[Dry Run] Workspace cleaned up. Success!");
        return;
    }

    try {
        console.log(`\nInvoking web-ext sign on temporary workspace (channel: ${channel})...`);
        
        // Construct web-ext command
        // We use npx to run web-ext without requiring it to be globally installed.
        // We pass --no-input to avoid interactive prompts.
        const cmd = `npx -y web-ext sign --source-dir="${distDir}" --api-key="${apiKey}" --api-secret="${apiSecret}" --channel="${channel}" --no-input`;
        
        execSync(cmd, { stdio: "inherit" });
        console.log("\n✓ Firefox extension signed/published successfully!");
    } catch (error) {
        console.error("\n❌ Error: Failed during web-ext signing process.");
        console.error(error.message);
        process.exit(1);
    } finally {
        console.log(`Cleaning up temporary workspace: ${distDir}`);
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }
    }
}

publish();
