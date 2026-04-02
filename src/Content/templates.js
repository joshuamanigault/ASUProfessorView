function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}


function getRatingColors(rating) {
    let ratingColor = '#6b7280';
    let ratingBg = '#f3f4f6';
    if (rating) {
        if (rating >= 4.0) {
            ratingColor = '#10b981';
            ratingBg = '#d1fae5';
        } else if (rating >= 3.0) {
            ratingColor = '#f59e0b';
            ratingBg = '#fef3c7';
        } else if (rating >= 2.0) {
            ratingColor = '#f97316';
            ratingBg = '#fed7aa';
        } else {
            ratingColor = '#ef4444';
            ratingBg = '#fecaca';
        }
    }

    return { ratingColor, ratingBg };
}

function getDifficultyColors(difficulty) {
    let difficultyColor = '#6b7280';
    let difficultyBg = '#f3f4f6';
    if (difficulty) {
        if (difficulty >= 4.0) {
            difficultyColor = '#ef4444';
            difficultyBg = '#fecaca';
        } else if (difficulty >= 3.0) {
            difficultyColor = '#f97316';
            difficultyBg = '#fed7aa';
        } else if (difficulty >= 2.0) {
            difficultyColor = '#f59e0b';
            difficultyBg = '#fef3c7';
        } else {
            difficultyColor = '#10b981';
            difficultyBg = '#d1fae5';
        }
    }

    return { difficultyColor, difficultyBg }
}

function createTagsHtml(tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return '';
    return `
        <div class="rmp-tags">
            ${tags.map(tag => `<span class="rmp-tag">${escapeHTML(tag)}</span>`).join('')}
        </div>
    `;
}


function createProfessorCardTemplate(name, data, showTags) {
    const rating = data.avgRating ? parseFloat(data.avgRating) : null;
    const numRatings = data.numRatings || 0;
    const difficulty = data.avgDifficulty ? parseFloat(data.avgDifficulty) : null;
    const department = data.department || 'Unknown Department';
    const professorId = data.legacyId || null;
    const topTags = showTags ? data.topTags : null;
    
    const { ratingColor, ratingBg } = getRatingColors(rating);
    const { difficultyColor } = getDifficultyColors(difficulty);
    
    return `
        <div class="rmp-card-content">
            <div class="rmp-header">
                <div class="rmp-info">
                    <div class="rmp-name">${
                        professorId
                            ? `<a href="https://www.ratemyprofessors.com/professor/${professorId}" target="_blank" rel="noopener noreferrer">${escapeHTML(name)}</a>`
                            : `${escapeHTML(name)}`
                    }</div>
                    <div class="rmp-department">${escapeHTML(department)}</div>
                </div>
                <div class="rmp-rating-badge" style="background-color: ${ratingBg}; color: ${ratingColor};">
                    ${rating ? rating.toFixed(1) : 'N/A'}
                </div>
            </div>
            <div class="rmp-stats">
                <div class="rmp-stat">
                    <span class="rmp-stat-label">Rating</span>
                    <span class="rmp-stat-value" style="color: ${ratingColor};">${rating ? rating.toFixed(1) : 'N/A'}</span>
                    <span class="rmp-stat-detail">${escapeHTML(numRatings)} reviews</span>
                </div>
                ${difficulty ? `
                <div class="rmp-stat">
                    <span class="rmp-stat-label">Difficulty</span>
                    <span class="rmp-stat-value" style="color: ${difficultyColor};">${difficulty.toFixed(1)}</span>
                    <span class="rmp-stat-detail">${difficulty >= 4.0 ? 'Very Hard' : difficulty >= 3.0 ? 'Hard' : 'Moderate'}</span>
                </div>
                ` : ''}
            </div>
            ${createTagsHtml(topTags)}
        </div>
    `;
}

function createNotFoundCardTemplate(name) {
    const normalizedName = (name || '').replace(/\s+/g, ' ').trim();
    const searchUrl = `https://www.ratemyprofessors.com/search/professors/15723?q=${encodeURIComponent(normalizedName)}`;

    return `
        <div class="rmp-card-content">
            <div class="rmp-header">
                <div class="rmp-info">
                    <div class="rmp-name">${escapeHTML(name)}</div>
                    <div class="rmp-department">Rate My Professor</div>
                </div>
                <div class="rmp-not-found-badge">
                    ?
                </div>
            </div>
            <div class="rmp-not-found-message">
                <div class="rmp-not-found-text">
                    <div class="rmp-not-found-title">No Data Found</div>
                    <div class="rmp-not-found-subtitle">
                        <a href="${searchUrl}" target="_blank" rel="noopener noreferrer">Search this professor on RateMyProfessor</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createCompactCardTemplate(name, data, showTags) {
    const rating = data.avgRating ? parseFloat(data.avgRating) : null;
    const difficulty = data.avgDifficulty ? parseFloat(data.avgDifficulty) : null;
    const professorId = data.legacyId || null;
    const topTags = showTags ? data.topTags : null;


    const { ratingColor, ratingBg } = getRatingColors(rating);
    const { difficultyColor, difficultyBg } = getDifficultyColors(difficulty);

    return `
        <div class="rmp-compact-card-content">
            <div class="rmp-compact-name">${
                    professorId
                        ? `<a href="https://www.ratemyprofessors.com/professor/${professorId}" target="_blank" rel="noopener noreferrer">${escapeHTML(name)}</a>`
                        : `${escapeHTML(name)}`
            }</div>
            <div>
                <div class="rmp-rating-badge" style="background-color: ${ratingBg}; color: ${ratingColor};">
                    ${rating ? rating.toFixed(1) : 'N/A'}
                </div>
                <span class="rmp-stat-label">Rating</span>
            </div>
            <div>
                <div class="rmp-rating-badge" style="background-color: ${difficultyBg}; color: ${difficultyColor};">
                    ${difficulty ? difficulty.toFixed(1) : 'N/A'}
                </div>
                <span class="rmp-stat-label">Difficulty</span>
            </div>
        </div>
        ${createTagsHtml(topTags)}
    `;
}

function createCompactNotFoundCardTemplate(name) {
    const normalizedName = (name || '').replace(/\s+/g, ' ').trim();
    const searchUrl = `https://www.ratemyprofessors.com/search/professors/15723?q=${encodeURIComponent(normalizedName)}`;

    return `
        <div class="rmp-compact-card-content">
            <div class="rmp-compact-name">${escapeHTML(name)}</div>
            <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="rmp-compact-not-found-message">
                No data · Search RMP
            </a>
        </div>
    `;
}

export function createProfessorCard(name, data, showTags) {
    const card = document.createElement('div');
    card.className = 'rmp-card';
    const content = createElementFromHTML(createProfessorCardTemplate(name, data, showTags));
    card.appendChild(content);
    return card;
}

export function createNotFoundCard(name) {
    const card = document.createElement('div');
    card.className = 'rmp-card rmp-not-found';
    const content = createElementFromHTML(createNotFoundCardTemplate(name));
    card.appendChild(content);
    return card;
}

export function createCompactCard(name, data, showTags) {
    const card = document.createElement('div');
    card.className = 'rmp-card rmp-compact-card';
    const content = createElementFromHTML(createCompactCardTemplate(name, data, showTags));
    card.appendChild(content);
    return card;
}

export function createCompactNotFoundCard(name) {
    const card = document.createElement('div');
    card.className = 'rmp-card rmp-compact-card';
    const content = createElementFromHTML(createCompactNotFoundCardTemplate(name));
    card.appendChild(content);
    return card;
}