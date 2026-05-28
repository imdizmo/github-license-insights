const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

async function runTests() {
    const pathToExtension = __dirname;
    console.log("Loading extension from:", pathToExtension);

    // Launch Chromium with the unpacked extension loaded
    const browserContext = await chromium.launchPersistentContext("", {
        headless: false, // Extension loading requires non-headless, but we can pass --headless=new
        args: [
            "--headless=new", // Run in headless mode using Chrome's modern headless engine which supports extensions
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
        ],
    });

    try {
        const page = await browserContext.newPage();
        await page.setViewportSize({ width: 1280, height: 800 });

        // Counter to track API calls
        let apiCallCount = 0;

        // 1. Route mock for API requests (globally on browserContext so service worker fetches are intercepted)
        await browserContext.route("https://api.github.com/repos/test-owner/test-repo/license", async (route) => {
            apiCallCount++;
            console.log("[Test Log] Intercepted GitHub API license request");
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    license: {
                        name: "MIT License",
                        spdx_id: "MIT"
                    },
                    content: btoa("This is a simple test license file content.")
                })
            });
        });

        // 2. Route mock for HTML repository page
        await page.route("https://github.com/test-owner/test-repo", async (route) => {
            console.log("[Test Log] Intercepted GitHub repo page request");
            await route.fulfill({
                status: 200,
                contentType: "text/html",
                body: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>test-owner/test-repo</title>
                        </head>
                        <body>
                            <div class="Layout-sidebar">
                                <div>
                                    <h2>About</h2>
                                    <p>Description of the repo</p>
                                    <div>
                                        <a href="/test-owner/test-repo/blob/main/LICENSE">MIT license</a>
                                    </div>
                                </div>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        console.log("Navigating to mocked GitHub repository page...");
        await page.goto("https://github.com/test-owner/test-repo");

        console.log("Waiting for badge UI element (.glb-badge)...");
        await page.waitForSelector(".glb-badge", { timeout: 5000 });

        // Verify Badge title and content
        const titleText = await page.textContent(".glb-title");
        console.log("Verified Badge Title:", titleText);
        assert.ok(titleText.includes("MIT"), "Badge title must show MIT license info");

        const allowedList = await page.textContent(".glb-allowed ul");
        console.log("Verified Allowed Terms:", allowedList.trim().replace(/\n/g, ", "));
        assert.ok(allowedList.includes("Commercial use"), "Badge must display MIT allowed conditions");

        console.log("✓ TEST 1 PASSED: Badge loaded and rendered license terms correctly.");

        // Capture screenshot of the MIT License badge
        const mitScreenshotPath = "/home/dizmo/.gemini/antigravity/brain/45543849-3616-466c-8b51-f1d3b083f8c0/screenshot_mit_license.png";
        await page.screenshot({ path: mitScreenshotPath });
        console.log("Saved MIT License screenshot to:", mitScreenshotPath);

        // 3. Test Caching: re-visit the same page and verify API is NOT queried again
        console.log("Navigating away and back to same repo to check caching...");
        await page.goto("about:blank");
        await page.goto("https://github.com/test-owner/test-repo");
        await page.waitForSelector(".glb-badge", { timeout: 5000 });

        console.log("API Call Count:", apiCallCount);
        assert.strictEqual(apiCallCount, 1, "GitHub API must only be called once due to extension caching");
        console.log("✓ TEST 2 PASSED: Caching mechanism worked.");

        // 4. Test Complex License detection (globally routed on browserContext)
        await browserContext.route("https://api.github.com/repos/test-owner/complex-repo/license", async (route) => {
            console.log("[Test Log] Intercepted GitHub API license request for complex-repo");
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    license: {
                        name: "Custom License",
                        spdx_id: "MIT"
                    },
                    content: btoa("This software has portions of this software licensed under different terms except as noted.")
                })
            });
        });

        await page.route("https://github.com/test-owner/complex-repo", async (route) => {
            console.log("[Test Log] Intercepted GitHub repo page request for complex-repo");
            await route.fulfill({
                status: 200,
                contentType: "text/html",
                body: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>test-owner/complex-repo</title>
                        </head>
                        <body>
                            <div class="Layout-sidebar">
                                <div>
                                    <h2>About</h2>
                                    <p>Description of the complex repo</p>
                                    <div>
                                        <a href="/test-owner/complex-repo/blob/main/LICENSE">MIT license</a>
                                    </div>
                                </div>
                            </div>
                        </body>
                    </html>
                `
            });
        });

        console.log("Navigating to complex repo page...");
        await page.goto("https://github.com/test-owner/complex-repo");
        
        console.log("Waiting for complex warning alert (.glb-alert)...");
        await page.waitForSelector(".glb-alert", { timeout: 5000 });

        const alertText = await page.textContent(".glb-alert");
        console.log("Verified Complex Warning:", alertText);
        assert.ok(alertText.includes("Complex/multi-licensing"), "Warning banner should be displayed");

        console.log("✓ TEST 3 PASSED: Complex license detected and warning banner displayed.");

        // Capture screenshot of the complex warning badge
        const complexScreenshotPath = "/home/dizmo/.gemini/antigravity/brain/45543849-3616-466c-8b51-f1d3b083f8c0/screenshot_complex_license.png";
        await page.screenshot({ path: complexScreenshotPath });
        console.log("Saved Complex License screenshot to:", complexScreenshotPath);

    } catch (error) {
        console.error("❌ TEST RUN FAILED:", error);
        process.exit(1);
    } finally {
        await browserContext.close();
    }
}

runTests();
