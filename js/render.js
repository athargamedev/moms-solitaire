/**
 * render.js -- Turns G (game state) into DOM.
 * Reads from: G, customization (customize.js), tokens
 */

const SUIT_SYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

// ── CARD ELEMENT FACTORY ──────────────────────────────────────────────────────
function makeCardEl(card, zIndex = 1) {
    const isRed = RED_SUITS.has(card.suit);
    const div = document.createElement('div');
    div.className = `card ${card.faceUp ? 'face-up' : 'face-down'} ${isRed ? 'red' : 'black'}`;
    div.dataset.suit  = card.suit;
    div.dataset.value = card.value;
    div.draggable = card.faceUp;
    div.style.zIndex  = zIndex;

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // ── FACE ──
    const face = document.createElement('div');
    face.className = 'card-face';
    const sym = SUIT_SYM[card.suit];
    face.innerHTML = `
        <div class="card-corner top">
            <span class="card-value">${card.value}</span>
            <span class="card-suit-small">${sym}</span>
        </div>
        <div class="card-center">
            <span class="card-suit-large">${sym}</span>
        </div>
        <div class="card-corner bottom">
            <span class="card-value">${card.value}</span>
            <span class="card-suit-small">${sym}</span>
        </div>`;

    // ── BACK ──
    const back = document.createElement('div');
    back.className = 'card-back';

    // Photo layer
    const imgLayer = document.createElement('div');
    imgLayer.className = 'card-back-image';
    if (CZ.cardPhoto) {
        imgLayer.style.backgroundImage = `url(${CZ.cardPhoto})`;
    }

    // Pattern overlay
    const pattern = document.createElement('div');
    pattern.className = 'card-back-pattern';
    if (CZ.cardPhoto) pattern.style.opacity = '0.18';

    // Message
    const logo = document.createElement('div');
    logo.className = 'card-back-logo';
    logo.textContent = CZ.cardMessage || '';
    logo.style.display = CZ.cardMessage ? '' : 'none';

    back.append(imgLayer, pattern, logo);
    inner.append(face, back);
    div.appendChild(inner);
    return div;
}

// ── PILE POSITIONING ──────────────────────────────────────────────────────────
function positionTableauCards(pileEl, cards) {
    pileEl.innerHTML = '';
    if (cards.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'pile-empty';
        ph.textContent = '♦';
        pileEl.appendChild(ph);
        return;
    }

    const FACE_DOWN_OFFSET = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tableau-overlap-face-down')) || 22;
    const FACE_UP_OFFSET   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tableau-overlap-face-up'))   || 32;

    let top = 0;
    cards.forEach((card, i) => {
        const el = makeCardEl(card, i + 1);
        el.style.top  = top + 'px';
        el.style.left = '0';
        pileEl.appendChild(el);
        top += card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
    });
    pileEl.style.minHeight = (top + 126) + 'px';
}

// ── RENDER FUNCTIONS ───────────────────────────────────────────────────────────
function renderStock() {
    const el = document.getElementById('stock');
    el.innerHTML = '';
    if (G.stock.length === 0) {
        el.innerHTML = '<span class="pile-placeholder" title="Click to reset">↻</span>';
    } else {
        const card = makeCardEl({ suit: 'spades', value: 'A', faceUp: false });
        card.style.position = 'absolute';
        card.style.top = card.style.left = '0';
        el.appendChild(card);
    }
}

function renderWaste() {
    const el = document.getElementById('waste');
    el.innerHTML = '';
    if (G.waste.length > 0) {
        const top = G.waste[G.waste.length - 1];
        const card = makeCardEl({ ...top, faceUp: true });
        card.style.position = 'absolute';
        card.style.top = card.style.left = '0';
        el.appendChild(card);
    }
}

function renderFoundations() {
    SUITS.forEach((suit, i) => {
        const el = document.getElementById(`foundation-${i}`);
        el.innerHTML = `<span class="pile-placeholder">${SUIT_SYM[suit]}</span>`;
        if (G.foundations[i].length > 0) {
            const top = G.foundations[i][G.foundations[i].length - 1];
            const card = makeCardEl({ ...top, faceUp: true });
            card.style.position = 'absolute';
            card.style.top = card.style.left = '0';
            el.innerHTML = '';
            el.appendChild(card);
        }
    });
}

function renderTableau() {
    for (let i = 0; i < 7; i++) {
        positionTableauCards(document.getElementById(`tableau-${i}`), G.tableau[i]);
    }
}

function renderAll() {
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    updateStats();
    renderTokenBar();
    renderCheerSquad();
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
    document.getElementById('moveCount').textContent  = G.moves;
    document.getElementById('scoreDisplay').textContent = G.score;
    const t = G.time;
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${m}:${s}s`;
}

// ── TOKEN BAR ─────────────────────────────────────────────────────────────────
function renderTokenBar() {
    if (!G.tokens) return;

    const tokens = G.tokens;

    // Update counts
    _updateTokenCount('undo', tokens.undo);
    _updateTokenCount('hint', tokens.hint);
    _updateTokenCount('peek', tokens.peek);
    _updateTokenCount('wand', tokens.wand);

    // Streak
    const streakEl = document.getElementById('token-streak-count');
    if (streakEl) {
        streakEl.textContent = G.quizStreak || 0;
        const streakItem = document.getElementById('token-streak');
        if (streakItem) {
            streakItem.classList.toggle('streak-active', (G.quizStreak || 0) >= 2);
        }
    }

    // Multiplier
    const multEl = document.getElementById('token-multiplier');
    if (multEl) {
        if (tokens.multiplier > 1 && tokens.multiplierMoves > 0) {
            multEl.style.display = 'flex';
            document.getElementById('token-multiplier-value').textContent = `x${tokens.multiplier}`;
            document.getElementById('token-multiplier-moves').textContent = `${tokens.multiplierMoves} moves`;
        } else {
            multEl.style.display = 'none';
        }
    }
}

function _updateTokenCount(type, count) {
    const countEl = document.getElementById(`token-${type}-count`);
    if (!countEl) return;

    const prev = parseInt(countEl.textContent) || 0;
    countEl.textContent = count;

    // Animate if count increased
    const item = document.getElementById(`token-${type}`);
    if (item) {
        item.classList.toggle('token-empty', count === 0);
        item.classList.toggle('token-available', count > 0);
        if (count > prev) {
            item.classList.add('token-earned');
            setTimeout(() => item.classList.remove('token-earned'), 600);
        }
    }
}

// ── CHEER SQUAD ───────────────────────────────────────────────────────────────
function renderCheerSquad() {
    const container = document.getElementById('cheerSquadInner');
    if (!container) return;

    const chars = (typeof getCharacters === 'function') ? getCharacters() : [];
    if (chars.length === 0) {
        container.innerHTML = '';
        const squad = document.getElementById('cheerSquad');
        if (squad) squad.style.display = 'none';
        return;
    }

    const squad = document.getElementById('cheerSquad');
    if (squad) squad.style.display = 'flex';

    // Only re-render if character count changed
    if (container.children.length === chars.length) return;

    container.innerHTML = '';
    const bdayChars = (typeof getBirthdayCharacters === 'function') ? getBirthdayCharacters() : [];

    chars.forEach(c => {
        const item = document.createElement('div');
        item.className = 'cheer-member';
        item.dataset.charId = c.id;

        const isBday = bdayChars.some(b => b.id === c.id);

        if (c.avatar) {
            item.innerHTML = `
                <div class="cheer-avatar ${isBday ? 'cheer-birthday' : ''}" style="background-image:url('${c.avatar}')">
                    ${isBday ? '<span class="cheer-crown">🎂</span>' : ''}
                </div>
                <span class="cheer-name">${c.name}</span>`;
        } else {
            item.innerHTML = `
                <div class="cheer-avatar cheer-initial ${isBday ? 'cheer-birthday' : ''}" style="background:${c.color || '#c9a55a'}">
                    ${c.name.charAt(0).toUpperCase()}
                    ${isBday ? '<span class="cheer-crown">🎂</span>' : ''}
                </div>
                <span class="cheer-name">${c.name}</span>`;
        }

        // Click to show a character bubble
        item.addEventListener('click', () => {
            const msg = (typeof getCharacterMessage === 'function')
                ? getCharacterMessage(c, 'foundation')
                : null;
            if (msg) {
                _renderAvatarBubble(c, msg, 3000);
            }
        });

        container.appendChild(item);
    });
}

// ── STATS MODAL ───────────────────────────────────────────────────────────────
function renderStatsModal() {
    const stats = (typeof getStats === 'function') ? getStats() : {};

    _setStatText('stat-games', stats.gamesPlayed || 0);
    _setStatText('stat-wins', stats.gamesWon || 0);

    const winrate = stats.gamesPlayed > 0
        ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) + '%'
        : '0%';
    _setStatText('stat-winrate', winrate);

    if (stats.bestTime !== null && stats.bestTime !== undefined) {
        const m = Math.floor(stats.bestTime / 60).toString().padStart(2, '0');
        const s = (stats.bestTime % 60).toString().padStart(2, '0');
        _setStatText('stat-best-time', `${m}:${s}`);
    } else {
        _setStatText('stat-best-time', '--:--');
    }

    _setStatText('stat-best-score', stats.bestScore || 0);
    _setStatText('stat-quizzes', `${stats.quizzesCorrect || 0}/${stats.quizzesAnswered || 0}`);
    _setStatText('stat-best-streak', stats.bestStreak || 0);
    _setStatText('stat-tokens-earned', stats.tokensEarned || 0);
}

function _setStatText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ── VICTORY SCREEN ENHANCEMENTS ───────────────────────────────────────────────
function renderVictoryExtras() {
    // Quiz stats
    const quizStatsEl = document.getElementById('victory-quiz-stats');
    if (quizStatsEl) {
        const answered = G.quizzesAnswered || 0;
        const correct = G.quizzesCorrect || 0;
        if (answered > 0) {
            quizStatsEl.innerHTML = `<p>🧠 Family Trivia: ${correct}/${answered} correct</p>`;
        } else {
            quizStatsEl.innerHTML = '';
        }
    }

    // Tokens summary
    const tokensEl = document.getElementById('victory-tokens');
    if (tokensEl) {
        const t = G.tokens || {};
        const total = (t.undo || 0) + (t.hint || 0) + (t.peek || 0) + (t.wand || 0);
        if (total > 0 || (G.quizzesCorrect || 0) > 0) {
            tokensEl.innerHTML = `<p>Tokens remaining: ↩️${t.undo || 0} 💡${t.hint || 0} 👁${t.peek || 0} 🪄${t.wand || 0}</p>`;
        } else {
            tokensEl.innerHTML = '';
        }
    }

    // Family cheers
    const cheersEl = document.getElementById('victory-family-cheers');
    if (cheersEl) {
        const chars = (typeof getCharacters === 'function') ? getCharacters() : [];
        if (chars.length > 0) {
            const messages = chars.slice(0, 3).map(c => {
                const msg = (typeof getCharacterMessage === 'function')
                    ? getCharacterMessage(c, 'win') : null;
                if (!msg) return '';
                const avatar = c.avatar
                    ? `<img src="${c.avatar}" class="victory-cheer-avatar">`
                    : `<span class="victory-cheer-initial" style="background:${c.color || '#c9a55a'}">${c.name.charAt(0)}</span>`;
                return `<div class="victory-cheer-item">${avatar}<span>${c.name}: ${msg}</span></div>`;
            }).filter(Boolean);
            cheersEl.innerHTML = messages.join('');
        } else {
            cheersEl.innerHTML = '';
        }
    }
}
