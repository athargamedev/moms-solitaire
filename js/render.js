/**
 * render.js – Turns G (game state) into DOM.
 * Reads from: G, customization (customize.js)
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

    // Pattern overlay (shows on top of photo dimly, hidden when photo set)
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
    // Ensure pile has enough height for click targets
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
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
    document.getElementById('moveCount').textContent  = G.moves;
    document.getElementById('scoreDisplay').textContent = G.score;
    const m = Math.floor(G.time / 60).toString().padStart(2, '0');
    const s = (G.time % 60).toString().padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${m}:${s}`;
}
