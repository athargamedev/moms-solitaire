/**
 * drag.js – HTML5 drag & drop + click handling for cards.
 */

let dragSrc   = null;  // 'waste' | 'tableau-N' | 'foundation-N'
let dragCard  = null;  // { suit, value }
let dragCards = [];    // array of cards being dragged

// ── DRAG START ────────────────────────────────────────────────────────────────
function onDragStart(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl || cardEl.classList.contains('face-down')) { e.preventDefault(); return; }

    const pileEl = cardEl.closest('#waste, [id^=foundation-], [id^=tableau-]');
    if (!pileEl) { e.preventDefault(); return; }

    dragCard = { suit: cardEl.dataset.suit, value: cardEl.dataset.value };

    if (pileEl.id === 'waste') {
        dragSrc   = 'waste';
        dragCards = [G.waste[G.waste.length - 1]];
    } else if (pileEl.id.startsWith('tableau-')) {
        dragSrc  = pileEl.id;
        const pi = parseInt(pileEl.id.split('-')[1]);
        const ci = G.tableau[pi].findIndex(c => c.suit === dragCard.suit && c.value === dragCard.value);
        dragCards = G.tableau[pi].slice(ci);
    } else if (pileEl.id.startsWith('foundation-')) {
        dragSrc  = pileEl.id;
        const fi = parseInt(pileEl.id.split('-')[1]);
        dragCards = [G.foundations[fi][G.foundations[fi].length - 1]];
    }

    cardEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    playSound('flip');
    startTimer();
}

// ── DRAG OVER / LEAVE / END ───────────────────────────────────────────────────
function onDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.pile, .tableau-pile');
    if (target) target.classList.add('drop-target');
}

function onDragLeave(e) {
    const target = e.target.closest('.pile, .tableau-pile');
    if (target && !target.contains(e.relatedTarget)) target.classList.remove('drop-target');
}

function onDragEnd() {
    document.querySelectorAll('.dragging, .drop-target').forEach(el => {
        el.classList.remove('dragging', 'drop-target');
    });
    dragSrc = dragCard = null; dragCards = [];
}

// ── DROP ──────────────────────────────────────────────────────────────────────
function onDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

    const pileEl = e.target.closest('.pile, .tableau-pile');
    if (!pileEl || !dragCard) return;

    const dest = pileEl.id;
    const result = moveCards(dragCard, dragSrc, dest);
    onDragEnd();

    if (result) {
        playSound('place');
        renderAll();
        saveGame();
        flashPile(pileEl);
        if (checkWin()) triggerWin();
    }
}

// ── CLICK HANDLING (stock + double-click auto-move) ──────────────────────────
function onGlobalClick(e) {
    // Stock
    if (e.target.closest('#stock')) {
        startTimer();
        drawFromStock(() => playSound('flip'));
        renderAll();
        saveGame();
        return;
    }

    // Double-click: auto-move to foundation
    if (e.detail === 2) {
        const cardEl = e.target.closest('.card');
        if (!cardEl || cardEl.classList.contains('face-down')) return;
        const pileEl = cardEl.closest('#waste, [id^=tableau-]');
        if (!pileEl) return;

        const card = { suit: cardEl.dataset.suit, value: cardEl.dataset.value };
        const from = pileEl.id === 'waste' ? 'waste' : pileEl.id;
        for (let i = 0; i < 4; i++) {
            if (canPlaceOnFoundation(card, i)) {
                startTimer();
                moveCards(card, from, `foundation-${i}`);
                playSound('place');
                renderAll();
                saveGame();
                popScore(e.clientX, e.clientY, '+10');
                if (checkWin()) triggerWin();
                return;
            }
        }
        shake(cardEl);
    }
}

// ── TOUCH DRAG (mobile) ───────────────────────────────────────────────────────
let touchCard   = null;
let touchClone  = null;
let touchFrom   = null;
let touchOffset = { x: 0, y: 0 };
let touchCardData = null;

function onTouchStart(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl || cardEl.classList.contains('face-down')) return;
    const pileEl = cardEl.closest('#waste, [id^=foundation-], [id^=tableau-]');
    if (!pileEl) return;

    touchCard = cardEl;
    touchFrom = pileEl.id;
    touchCardData = { suit: cardEl.dataset.suit, value: cardEl.dataset.value };

    const rect = cardEl.getBoundingClientRect();
    const t = e.touches[0];
    touchOffset.x = t.clientX - rect.left;
    touchOffset.y = t.clientY - rect.top;

    touchClone = cardEl.cloneNode(true);
    touchClone.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        width:${rect.width}px; height:${rect.height}px;
        transform:scale(1.07) rotate(2deg);
        box-shadow:0 20px 50px rgba(0,0,0,0.55);
        transition:none; opacity:0.92;
    `;
    document.body.appendChild(touchClone);
    moveTouchClone(t);
    startTimer();
}

function onTouchMove(e) {
    if (!touchClone) return;
    e.preventDefault();
    moveTouchClone(e.touches[0]);
}

function onTouchEnd(e) {
    if (!touchClone) return;
    touchClone.remove();
    touchClone = null;

    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el) return;

    const pileEl = el.closest('.pile, .tableau-pile');
    if (!pileEl || !touchCardData) return;

    const result = moveCards(touchCardData, touchFrom, pileEl.id);
    if (result) {
        playSound('place');
        renderAll();
        saveGame();
        if (checkWin()) triggerWin();
    }
    touchCard = touchFrom = touchCardData = null;
}

function moveTouchClone(t) {
    touchClone.style.left = (t.clientX - touchOffset.x) + 'px';
    touchClone.style.top  = (t.clientY - touchOffset.y) + 'px';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function flashPile(el) {
    el.classList.add('pulse-valid');
    setTimeout(() => el.classList.remove('pulse-valid'), 700);
}

function shake(cardEl) {
    cardEl.classList.add('shake');
    setTimeout(() => cardEl.classList.remove('shake'), 500);
}

function popScore(x, y, text) {
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}
