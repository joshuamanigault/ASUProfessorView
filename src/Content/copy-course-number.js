const FEEDBACK_DURATION_MS = 2000;

function readClassNumber(cell) {
    // ASU renders the number and instructor as sibling cells in this result row.
    const numberCell = cell.closest('.class-accordion')?.querySelector(':scope > .class-results-cell.number');
    if (!numberCell) return null;

    const content = numberCell.cloneNode(true);
    content.querySelectorAll('.sr-only').forEach(label => label.remove());
    const number = content.textContent.trim();
    return /^\d+$/.test(number) ? number : null;
}

export function bindCopyCourseNumber(card, cell, isActive) {
    const button = card.querySelector('.rmp-copy-course-number');
    if (!button) return;

    const status = card.querySelector('.rmp-copy-course-number-status');
    const win = cell.ownerDocument.defaultView;
    let feedbackTimeout;

    function clearFeedback() {
        win.clearTimeout(feedbackTimeout);
        status.textContent = '';
        delete button.dataset.copyState;
    }

    function showFeedback(message, state) {
        status.textContent = message;
        button.dataset.copyState = state;
        feedbackTimeout = win.setTimeout(clearFeedback, FEEDBACK_DURATION_MS);
    }

    // Keep ASU's accordion keyboard handler from also activating the row.
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    });

    button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (!isActive() || !cell.isConnected || !button.isConnected || button.disabled) return;
        clearFeedback();

        // Read on click: ASU may reuse a row while keeping its instructor cards.
        const number = readClassNumber(cell);
        if (!number) {
            showFeedback('Class number unavailable.', 'error');
            return;
        }
        if (!win.navigator.clipboard?.writeText) {
            showFeedback('Clipboard unavailable. Copy the class number manually.', 'error');
            return;
        }

        button.disabled = true;
        try {
            // Invoke before any asynchronous work so this retains the user's click.
            await win.navigator.clipboard.writeText(number);
            if (isActive() && button.isConnected) showFeedback('Copied!', 'success');
        } catch {
            if (isActive() && button.isConnected) showFeedback('Could not copy. Try again.', 'error');
        } finally {
            button.disabled = false;
        }
    });
}
