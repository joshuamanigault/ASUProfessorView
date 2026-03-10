import styles from './content.styles.css?inline'
import { createProfessorCard, createNotFoundCard, createCompactCard, createCompactNotFoundCard } from "./templates.js";
import { Semaphore } from "es-toolkit";

const semaphore = new Semaphore(3);
const divNameMap = new Map();

function findProfessors() {
    divNameMap.clear();
    const instructorDivs = document.querySelectorAll('div.instructor.class-results-cell');
    const names = [];
    const namesCheck = new Set();

    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;

        // Remove hyphens and extra spaces from the name
        const rawName = link.innerText.trim();
        const normalizedName = rawName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

        if (div.querySelector('.rmp-card')) return;

        if (divNameMap.has(normalizedName)) {
            divNameMap.get(normalizedName).push(div);
        } else {
            divNameMap.set(normalizedName, [div]);
        }

        if (!namesCheck.has(normalizedName)) {
            names.push(normalizedName);
            namesCheck.add(normalizedName);
        };
    });

    if (names.length > 0) {
        processProfessorConcurrently(names);
    }
}


function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

async function processProfessorConcurrently(names)  {
    if (!chrome.runtime?.id) {
        console.error('Extension context invalidated - please refresh the page');
        return;
    }

    const options = await new Promise((resolve) => {
        chrome.storage.sync.get({ compact_cards: false, show_tags: false }, (prefs) => {
            resolve({
                useCompact: Boolean(prefs.compact_cards),
                showTags: Boolean(prefs.show_tags)
            });
        });
    });

    const tasks = names.map(async (name) => {
        await semaphore.acquire();
        try {
            const response = await sendMessage({professorName: name});

            if (response?.success) {
                injectProfessorCard(name, response.data, options.useCompact, options.showTags);
            } else {
                injectNotFoundCard(name, options.useCompact);
            }
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                console.error('Extension context invalidated - please refresh the page');
                return;
            } else {
                injectNotFoundCard(name, options.useCompact);
            }
            console.error('Error fetching data for: ' + name, error);
        } finally {
            semaphore.release();
        }
    });

    await Promise.all(tasks);
}

function injectProfessorCard(name, data, compactOption, showTagOption) {
    const instructorDivs = divNameMap.get(name) || [];
    
    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;
        
        const rawLinkName = link.innerText.trim();
        const normalizedLinkName = rawLinkName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (normalizedLinkName !== name) return;
        if (div.querySelector('.rmp-card')) return;

        let card;
        if (compactOption) {
            card = createCompactCard(name, data, showTagOption) 
        } else {
            card = createProfessorCard(name, data, showTagOption);
        }

        if (card) {
            link.insertAdjacentElement('afterend', card);
        }
    });
}

function injectNotFoundCard(name, compactOption) {
    const instructorDivs = divNameMap.get(name) || [];
    
    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;

        const rawLinkName = link.innerText.trim();
        const normalizedLinkName = rawLinkName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

        if (normalizedLinkName !== name) return;
        if (div.querySelector('.rmp-card')) return;

        let card;
        if (compactOption) {
            card = createCompactNotFoundCard(name);
        } else {
            card = createNotFoundCard(name);
        }

        if (card) {
            link.insertAdjacentElement('afterend', card);
        }
    });
}


(function injectCardStyles() {
    if (document.getElementById('rmp-card-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'rmp-card-styles';
    style.textContent = styles;

    document.head.appendChild(style);
})();


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Find professors on the initial load of the website
window.addEventListener('load', findProfessors);

// Also run immediately in case the page is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findProfessors);
} else {
    findProfessors();
}
    
// Observe dynamically added elements with debouncing
const MUTATION_DEBOUNCE_MS = 250; 
const observer = new MutationObserver(debounce(findProfessors, MUTATION_DEBOUNCE_MS));
observer.observe(document.body, { childList: true, subtree: true });