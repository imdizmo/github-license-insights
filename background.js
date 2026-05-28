const CACHE_TTL_SUCCESS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_FAILURE = 1 * 60 * 60 * 1000;  // 1 hour

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_LICENSE_DATA") {
        const { owner, repo } = message.payload;
        getLicenseData(owner, repo)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => {
                console.error("[GLB SW] Error fetching license:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }
});

/**
 * Fetch license data with storage-based caching.
 */
async function getLicenseData(owner, repo) {
    const cacheKey = `license_${owner.toLowerCase()}_${repo.toLowerCase()}`;
    
    try {
        const cached = await chrome.storage.local.get(cacheKey);
        const cachedEntry = cached[cacheKey];
        
        if (cachedEntry) {
            const age = Date.now() - cachedEntry.timestamp;
            const ttl = cachedEntry.data ? CACHE_TTL_SUCCESS : CACHE_TTL_FAILURE;
            
            if (age < ttl) {
                console.log(`[GLB SW] Cache hit for ${owner}/${repo}`);
                return cachedEntry.data;
            }
        }
    } catch (e) {
        console.warn("[GLB SW] Cache read failed:", e);
    }

    console.log(`[GLB SW] Cache miss. Fetching API for ${owner}/${repo}`);
    
    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/license`);
        
        if (!res.ok) {
            // Cache negative results for a shorter duration
            await saveToCache(cacheKey, null);
            return null;
        }

        const data = await res.json();
        
        let decodedContent = "";
        if (data.content) {
            try {
                // Remove whitespace/newlines before decoding
                const cleanBase64 = data.content.replace(/\s/g, "");
                decodedContent = atob(cleanBase64);
            } catch (err) {
                console.error("[GLB SW] Failed to decode base64 content:", err);
            }
        }

        const licenseData = {
            name: data.license?.name || "UNKNOWN",
            spdx: data.license?.spdx_id || "UNKNOWN",
            content: decodedContent
        };

        await saveToCache(cacheKey, licenseData);
        return licenseData;
    } catch (error) {
        console.error(`[GLB SW] Network request failed for ${owner}/${repo}:`, error);
        // Do not cache network/temporary errors
        return null;
    }
}

/**
 * Helper to save entries to chrome.storage.local.
 */
async function saveToCache(key, data) {
    try {
        await chrome.storage.local.set({
            [key]: {
                data,
                timestamp: Date.now()
            }
        });
    } catch (e) {
        console.warn("[GLB SW] Cache write failed:", e);
    }
}
