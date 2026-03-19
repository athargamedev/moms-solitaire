/**
 * autoplay.js – Smart assistance features for Mom:
 * 1. "Play Next Move" button – makes ONE valid move automatically
 * 2. "Auto-Complete" – cascades all cards to foundations when solvable
 * 3. Progress bar – shows % of cards in foundations
 * 4. Solvability check – tells Mom if the game can still be won
 */

// ── PROGRESS BAR ──────────────────────────────────────────────────────────────
function updateProgressBar() {
    const total = G.foundations.reduce((s, f) => s + f.length, 0);
    const pct = Math.round((total / 52) * 100);
    const bar = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    if (bar)   bar.style.width = pct + '%';
    if (label) label.textContent = pct > 0 ? `${pct}% complete` : 'Get those Aces!';

    // Color shifts as you get closer to winning
    if (bar) {
        if (pct < 30)      bar.style.background = 'linear-gradient(90deg, #c9a55a, #e0bc78)';
        else if (pct < 60) bar.style.background = 'linear-gradient(90deg, #7a9e7a, #6b9b7a)';
        else if (pct < 90) bar.style.background = 'linear-gradient(90deg, #3a7abf, #60a5fa)';
        else               bar.style.background = 'linear-gradient(90deg, #c9a55a, #f9d97a, #c9a55a)';
    }
}

// ── PLAY NEXT MOVE (assisted) ─────────────────────────────────────────────────
function playNextMove() {
    const hint = findHint();
    if (!hint) {
        // Try drawing from stock
        if (G.stock.length > 0 || G.waste.length > 0) {
            drawFromStock(() => playSound('flip'));
            onStockDraw();
            renderAll();
            saveGame();
            showJokeBubble("Drawing from stock — let's see what we got! 🃏", 2000);
        } else {
            showJokeBubble("No more moves! You might need to start a new game. 😅", 3000);
        }
        return;
    }

    const result = moveCards(hint.card, hint.from, hint.to);
    if (result) {
        playSound('place');

        // Check if it was a foundation move
        if (hint.to.startsWith('foundation')) {
            const fi = parseInt(hint.to.split('-')[1]);
            onFoundationPlace(fi);
            spawnFoundationBurst(hint.to);
        }
        if (hint.card.value === 'K') onKingMove();

        renderAll();
        updateProgressBar();
        saveGame();
        showJokeBubble("There we go! I found a move for you! 💡", 2000);
        if (checkWin()) triggerWin();
    }
}

// ── AUTO-COMPLETE ─────────────────────────────────────────────────────────────
// Only available when all tableau cards are face-up (game is trivially solvable)
function canAutoComplete() {
    // All tableau cards must be face-up
    for (const pile of G.tableau) {
        if (pile.some(c => !c.faceUp)) return false;
    }
    // Must also have no face-down stock cards
    return G.stock.length === 0;
}

function autoComplete() {
    if (!canAutoComplete()) {
        showJokeBubble("Not yet! Flip all the cards first. Almost there! 🌟", 2500);
        return;
    }
    showJokeBubble("Auto-completing! Watch and enjoy! 🎉", 2000);
    _autoPlayStep(0);
}

function _autoPlayStep(delay) {
    const hint = findHint();
    if (!hint) {
        // Try drawing
        if (G.stock.length > 0 || G.waste.length > 0) {
            drawFromStock();
            renderAll();
            setTimeout(() => _autoPlayStep(200), 200);
        } else if (checkWin()) {
            triggerWin();
        }
        return;
    }

    setTimeout(() => {
        const result = moveCards(hint.card, hint.from, hint.to);
        if (result) {
            playSound('place');
            if (hint.to.startsWith('foundation')) {
                spawnFoundationBurst(hint.to);
            }
            renderAll();
            updateProgressBar();
            saveGame();
            if (checkWin()) { triggerWin(); return; }
            _autoPlayStep(180);
        }
    }, delay + 180);
}

// ── FOUNDATION BURST EFFECT ───────────────────────────────────────────────────
function spawnFoundationBurst(foundationId) {
    const el = document.getElementById(foundationId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const colors = ['#c9a55a', '#e0bc78', '#f5d787', '#fff8e0'];
    for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        p.style.cssText = `
            position: fixed;
            left: ${cx}px;
            top: ${cy}px;
            width: ${4 + Math.random() * 6}px;
            height: ${4 + Math.random() * 6}px;
            border-radius: 50%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            pointer-events: none;
            z-index: 4500;
        `;
        document.body.appendChild(p);

        const angle = (i / 18) * Math.PI * 2;
        const dist  = 40 + Math.random() * 50;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;

        p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], { duration: 550 + Math.random() * 200, easing: 'ease-out', fill: 'forwards' })
         .onfinish = () => p.remove();
    }
}

// ── AUTO-COMPLETE BUTTON VISIBILITY ───────────────────────────────────────────
function refreshAutoCompleteBtn() {
    const btn = document.getElementById('autoCompleteBtn');
    if (!btn) return;
    if (canAutoComplete()) {
        btn.style.display = 'flex';
        btn.classList.add('pulse-glow');
    } else {
        btn.style.display = 'none';
        btn.classList.remove('pulse-glow');
    }
}
