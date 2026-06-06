const clearCacheButton = document.getElementById("clear-cache-button");
const clearCacheButtonLabel = document.getElementById("clear-cache-button-label");

if (clearCacheButton) {
    clearCacheButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "clearProfessorCache" }, (response) => {
            if (chrome.runtime.lastError) {
                if (clearCacheButtonLabel) {
                    clearCacheButtonLabel.textContent = "Failed to Clear";
                }
                console.error("Failed to clear professor cache via popup button:", chrome.runtime.lastError.message);
                setTimeout(() => {
                    if (clearCacheButtonLabel) {
                        clearCacheButtonLabel.textContent = "Clear Cache";
                    }
                }, 2000);
                return;
            }

            if (response?.success) {
                if (clearCacheButtonLabel) {
                    clearCacheButtonLabel.textContent = "Cache Cleared!";
                }
                setTimeout(() => {
                    if (clearCacheButtonLabel) {
                        clearCacheButtonLabel.textContent = "Clear Cache";
                    }
                }, 2000);
            } else {
                if (clearCacheButtonLabel) {
                    clearCacheButtonLabel.textContent = "Failed to Clear!";
                }
                console.error("Failed to clear professor cache via popup button:", response?.error);
                setTimeout(() => {
                    if (clearCacheButtonLabel) {
                        clearCacheButtonLabel.textContent = "Clear Cache";
                    }
                }, 2000);
            }
        });
    });
}
