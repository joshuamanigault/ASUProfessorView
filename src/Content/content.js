import styles from './content.styles.css?inline'
import { createProfessorCard, createNotFoundCard, createCompactCard, createCompactNotFoundCard } from "./templates.js";
import { Semaphore } from "es-toolkit";

const semaphore = new Semaphore(3);

function findProfessors() {
    const instructorDivs = document.querySelectorAll('div.instructor.class-results-cell');
    const names = [];

    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;

        // Remove hyphens and extra spaces from the name
        const rawName = link.innerText.trim();
        const normalizedName = rawName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

        if (!div.querySelector('.rmp-card') && !names.includes(normalizedName)) {
            names.push(normalizedName);
        }
    });

    if (names.length > 0) {
        processProfessorConcurrently(names);
    } 
}

// Send message to background script

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

    const tasks = names.map(async (name) => {
        await semaphore.acquire();
        try {
            const response = await sendMessage({professorName: name});
            console.debug('Data for: ' + name, response); 

            if (response?.success) {
                injectProfessorCard(name, response.data);
            } else {
                injectNotFoundCard(name);
            }
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                console.error('Extension context invalidated - please refresh the page');
                return;
            } else {
                injectNotFoundCard(name);
            }
            console.error('Error fetching data for: ' + name, error);
        } finally {
            semaphore.release();
        }
    });

    await Promise.all(tasks);
}

function injectProfessorCard(name, data) {
    const instructorDivs = document.querySelectorAll('div.instructor.class-results-cell');
    
    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;
        
        const rawLinkName = link.innerText.trim();
        const normalizedLinkName = rawLinkName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (normalizedLinkName !== name) return;
        if (div.querySelector('.rmp-card')) return;
        
        chrome.storage.sync.get({ compact_cards: false, show_tags: false }, (result) => {
            // Re-check in callback to avoid race conditions with repeated observers/responses
            if (div.querySelector('.rmp-card')) return;

            const useCompact = Boolean(result.compact_cards);
            const showTags = Boolean(result.show_tags);
            let card;

            if (useCompact) {
                card = createCompactCard(name, data, showTags);
            } else {
                card = createProfessorCard(name, data, showTags);
            }

            if (card) {
                link.insertAdjacentElement('afterend', card);
            }
        });
    });
}

function injectNotFoundCard(name) {
    const instructorDivs = document.querySelectorAll('div.instructor.class-results-cell');
    
    instructorDivs.forEach((div) => {
        const link = div.querySelector('a');
        if (!link) return;

        const rawLinkName = link.innerText.trim();
        const normalizedLinkName = rawLinkName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

        if (normalizedLinkName !== name) return;
        if (div.querySelector('.rmp-card')) return;

        chrome.storage.sync.get({ compact_cards: false }, (result) => {
            if (div.querySelector('.rmp-card')) return;

            const useCompact = Boolean(result.compact_cards);
            let card;

            if (useCompact) {
                card = createCompactNotFoundCard(name);
            } else {
                card = createNotFoundCard(name);
            }

            if (card) {
                link.insertAdjacentElement('afterend', card);
            }
        });
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

// Run after page load
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