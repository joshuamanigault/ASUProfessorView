const clearCacheButton = document.getElementById("clear-cache-button");

if (clearCacheButton) {
    clearCacheButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "clearProfessorCache" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Failed to clear professor cache via popup button:", chrome.runtime.lastError.message);
                return;
            }

            if (response?.success) {
                clearCacheButton.textContent = "Cache Cleared!";
                setTimeout(() => {
                    clearCacheButton.textContent = "Clear Professor Cache";
                }, 2000);
            } else {
                clearCacheButton.textContent = "Failed to Clear!";
                console.error("Failed to clear professor cache via popup button:", response?.error);
            }
        });
    });
}
