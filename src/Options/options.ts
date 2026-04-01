type Options = {
    compact_cards: boolean;
    show_tags: boolean;
};

// Defaults used when no user preference is stored yet
const DEFAULTS: Options = {
    compact_cards: false,
    show_tags: false
};

// Map option keys to DOM element ids
const KEY_TO_ID: Record<keyof Options, string> = {
    compact_cards: "compact-cards",
    show_tags: "show-tags",
};

function setStoreLink() {
    // @ts-expect-error: InstallTrigger is a Firefox specific global
    const isFirefox = typeof InstallTrigger !== "undefined";
    let storeUrl = "https://chromewebstore.google.com/detail/asu-professorview/kniajfafepienoohdheheofabfclpgnl";
    if (isFirefox) {
        storeUrl = "https://addons.mozilla.org";  // TODO: add actual firefox store when done tesing
    }
    
    document.querySelectorAll<HTMLAnchorElement>("a.store-link").forEach((a) => {
        a.href = storeUrl;
    });
}

function setCheckboxDom(id: string, checked: boolean) {
    const el = document.getElementById(id);
    if (!el) return;
    if (checked) {
        el.classList.add("checked");
        el.setAttribute("aria-checked", "true");
    } else {
        el.classList.remove("checked");
        el.setAttribute("aria-checked", "false");
    }
}

function loadOptions(): Promise<Options> {
    return new Promise((resolve) => {
        // Using chrome.storage.sync with defaults fallback
        chrome.storage.sync.get(DEFAULTS, (result) => {
            // Result is a partial that always contains the provided defaults
            resolve({
                compact_cards: Boolean(result.compact_cards),
                show_tags: Boolean(result.show_tags)
            });
        });
    });
}

function saveOptions(update: Partial<Options>): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.sync.set(update, () => resolve());
    });
}

function bindCheckbox(key: keyof Options) {
    const id = KEY_TO_ID[key];
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("click", async () => {
        const next = !el.classList.contains("checked");
        setCheckboxDom(id, next);
        await saveOptions({ [key]: next } as Partial<Options>);
    });

    el.addEventListener("keydown", async (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            el.click();
        }
    });
}

async function initOptionsPage() {
    setStoreLink();

    // Load saved values and reflect in UI
    const opts = await loadOptions();
    setCheckboxDom(KEY_TO_ID.compact_cards, opts.compact_cards);
    setCheckboxDom(KEY_TO_ID.show_tags, opts.show_tags);

    // Bind interactions
    bindCheckbox("compact_cards");
    bindCheckbox("show_tags");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOptionsPage);
} else {
    initOptionsPage();
}