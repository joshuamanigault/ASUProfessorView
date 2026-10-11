import { Semaphore } from 'es-toolkit';
import { createProfessorCard, createNotFoundCard, createCompactCard, createCompactNotFoundCard } from './templates.js';

const INSTRUCTOR_SELECTOR = 'div.instructor.class-results-cell';
const MUTATION_DEBOUNCE_MS = 250;

function normalizeName(name) {
    return name.replace(/^'[^']+'\s*/, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function findInstructors(cell) {
    const instructors = new Map();
    for (const link of cell.querySelectorAll('a[href]')) {
        // Exclude our RMP links, duplicated responsive links, and unrelated cell links.
        if (link.closest('.rmp-card-list')) continue;
        let url;
        try {
            url = new URL(link.href);
        } catch {
            continue;
        }
        if (url.hostname !== 'search.asu.edu' || !url.pathname.startsWith('/profile/')) continue;
        const name = normalizeName(link.textContent || '');
        if (name) instructors.set(url.pathname, { id: url.pathname, name });
    }
    return Array.from(instructors.values());
}

export function startProfessorCards(doc, extension) {
    const semaphore = new Semaphore(3);
    const cellStates = new WeakMap();
    const inFlight = new Map();
    let timeout;
    let stopped = false;
    let optionsPromise;

    function loadOptions() {
        optionsPromise ??= new Promise((resolve, reject) => {
            extension.storage.sync.get({ compact_cards: false, show_tags: false }, (prefs) => {
                if (extension.runtime.lastError) {
                    reject(new Error(extension.runtime.lastError.message));
                } else {
                    resolve({ useCompact: Boolean(prefs.compact_cards), showTags: Boolean(prefs.show_tags) });
                }
            });
        });
        return optionsPromise;
    }

    function lookup(name) {
        if (inFlight.has(name)) return inFlight.get(name);
        const task = (async () => {
            await semaphore.acquire();
            try {
                if (stopped || !extension.runtime?.id) throw new Error('Extension context invalidated');
                return await new Promise((resolve, reject) => {
                    extension.runtime.sendMessage({ professorName: name }, (response) => {
                        if (extension.runtime.lastError) {
                            reject(new Error(extension.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
            } finally {
                semaphore.release();
            }
        })().finally(() => inFlight.delete(name));
        inFlight.set(name, task);
        return task;
    }

    async function fillSlot(cell, state, slot, name) {
        try {
            const options = await loadOptions();
            let response;
            try {
                response = await lookup(name);
            } catch (error) {
                if (error.message?.includes('Extension context invalidated')) throw error;
                console.error('Error fetching data for: ' + name, error);
            }
            // ASU can replace a row or its instructors before a request completes.
            if (stopped || !cell.isConnected || cellStates.get(cell) !== state || state.container.parentElement !== cell) return;
            if (JSON.stringify(findInstructors(cell)) !== state.signature) return;
            const createFound = options.useCompact ? createCompactCard : createProfessorCard;
            const createMissing = options.useCompact ? createCompactNotFoundCard : createNotFoundCard;
            slot.replaceChildren(response?.success
                ? createFound(name, response.data, options.showTags)
                : createMissing(name));
        } catch (error) {
            console.error('Could not display professor card:', error);
        }
    }

    function scan() {
        if (stopped) return;
        for (const cell of doc.querySelectorAll(INSTRUCTOR_SELECTOR)) {
            const instructors = findInstructors(cell);
            const signature = JSON.stringify(instructors);
            const previous = cellStates.get(cell);
            if (previous?.signature === signature && previous.container.parentElement === cell) continue;
            previous?.container.remove();
            const container = doc.createElement('div');
            container.className = 'rmp-card-list';
            const state = { signature, container };
            cellStates.set(cell, state);
            if (!instructors.length) continue;

            // Sibling of ASU's desktop/mobile name spans, never between instructor links.
            cell.appendChild(container);
            for (const { id, name } of instructors) {
                const slot = doc.createElement('div');
                slot.className = 'rmp-card-slot';
                slot.dataset.instructorId = id;
                container.appendChild(slot);
                void fillSlot(cell, state, slot, name);
            }
        }
    }

    function isRelevantMutation(record) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target?.closest('.rmp-card-list')) return false;
        const changedNodes = [...record.addedNodes, ...record.removedNodes];
        if (!record.removedNodes.length && changedNodes.length
            && changedNodes.every(node => node.nodeType === 1 && node.matches('.rmp-card-list'))) return false;
        return Boolean(target?.closest(INSTRUCTOR_SELECTOR) || changedNodes.some(node =>
            node.nodeType === 1 && (node.matches(INSTRUCTOR_SELECTOR) || node.querySelector(INSTRUCTOR_SELECTOR))));
    }

    function scheduleScan(records) {
        if (!records.some(isRelevantMutation)) return;
        clearTimeout(timeout);
        timeout = setTimeout(scan, MUTATION_DEBOUNCE_MS);
    }

    const observer = new doc.defaultView.MutationObserver(scheduleScan);
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
    scan();

    return {
        scan,
        disconnect() {
            stopped = true;
            clearTimeout(timeout);
            observer.disconnect();
        },
    };
}
