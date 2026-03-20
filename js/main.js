/**
 * main.js – App entry point: wires up all modules.
 * Load order: game.js → customize.js → sounds.js → jokes.js → autoplay.js → render.js → drag.js → main.js
 */

// ── TIMER ─────────────────────────────────────────────────────────────────────
let _timerInterval = null;

function startTimer() {
    if (G.started || G.won) return;
    G.started = true;
    _timerInterval = setInterval(() => {
        G.time++;
        updateStats();
        // Long game jokes
        if (G.time === 600)  onLongGame(10);
        if (G.time === 1200) onLongGame(20);
        // Milestone checks
        onMilestone(G.moves);
    }, 1000);
}

function stopTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
}

// ── FULL RENDER (with extras) ─────────────────────────────────────────────────
function fullRender() {
    renderAll();
    updateProgressBar();
    refreshAutoCompleteBtn();
}

// ── WIN ───────────────────────────────────────────────────────────────────────
function triggerWin() {
    G.won = true;
    stopTimer();
    G.score += Math.max(0, Math.floor(100000 / (G.time + 1)));
    updateStats();
    playSound('win');
    showJokeBubble(getJoke('win'), 5000);
    setTimeout(() => showVictory(), 800);
    spawnConfetti();
}

function showVictory() {
    const el = document.getElementById('victoryOverlay');
    el.querySelector('#victory-stats').innerHTML =
        `🏆 ${G.moves} moves &nbsp;|&nbsp; ⏱ ${document.getElementById('timeDisplay').textContent} &nbsp;|&nbsp; ⭐ ${G.score} pts`;
    el.classList.add('active');
}

function hideVictory() {
    document.getElementById('victoryOverlay').classList.remove('active');
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function spawnConfetti() {
    const colors = ['#c9a55a','#e0bc78','#b85c5c','#3a5a8a','#7a9e7a','#f0ebe0','#d4a8c8'];
    for (let i = 0; i < 140; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti-piece';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.top  = '-12px';
            c.style.width = c.style.height = (Math.random() * 9 + 5) + 'px';
            c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDuration = (Math.random() * 2 + 2) + 's';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4500);
        }, i * 22);
    }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

// ── HINT ──────────────────────────────────────────────────────────────────────
function showHint() {
    document.querySelectorAll('.hint-highlight').forEach(el => el.classList.remove('hint-highlight'));
    const hint = findHint();
    if (!hint) {
        showJokeBubble(getJoke('stuck'), 3000);
        return;
    }
    const addHL = (sel) => document.querySelector(sel)?.classList.add('hint-highlight');
    if (hint.from === 'waste') {
        addHL('#waste .card');
    } else {
        const [type, idx] = hint.from.split('-');
        if (type === 'tableau') {
            const cards = document.querySelectorAll(`#tableau-${idx} .card.face-up`);
            cards[0]?.classList.add('hint-highlight');
        }
    }
    addHL(`#${hint.to}`);
    setTimeout(() => document.querySelectorAll('.hint-highlight').forEach(el => el.classList.remove('hint-highlight')), 2200);
    showToast('💡 Try that highlighted card!');
}

// ── OVERRIDDEN DRAG.JS EVENTS (wired to joke system) ─────────────────────────
// We patch onGlobalClick to integrate jokes — original onDrop in drag.js calls moveCards directly.
// We intercept the result in setupEvents by decorating the key functions.

function _onStockClick() {
    startTimer();
    const had = G.stock.length > 0 || G.waste.length > 0;
    drawFromStock(() => playSound('flip'));
    if (had) onStockDraw();
    fullRender();
    saveGame();
}

function _autoMoveToFoundation(cardEl, pileEl) {
    const card = { suit: cardEl.dataset.suit, value: cardEl.dataset.value };
    const from = pileEl.id === 'waste' ? 'waste' : pileEl.id;
    for (let i = 0; i < 4; i++) {
        if (canPlaceOnFoundation(card, i)) {
            startTimer();
            moveCards(card, from, `foundation-${i}`);
            playSound('place');
            onFoundationPlace(i);
            spawnFoundationBurst(`foundation-${i}`);
            if (card.value === 'K') onKingMove();
            onMilestone(G.moves);
            fullRender();
            saveGame();
            resetStockJoke();
            if (checkWin()) triggerWin();
            return true;
        }
    }
    return false;
}

// ── WIRE UP EVENTS ────────────────────────────────────────────────────────────
function setupEvents() {
    // Header buttons
    document.getElementById('newGameBtn').addEventListener('click', () => {
        if (confirm('Start a new game?')) {
            stopTimer();
            newGame();
            resetJokeState();
            fullRender();
            saveGame();
            showJokeBubble('New game! Good luck! 🍀', 2000);
        }
    });

    document.getElementById('undoBtn').addEventListener('click', () => {
        if (undoMove()) {
            fullRender();
            onUndo();
        } else {
            showToast('Nothing to undo.');
        }
    });

    document.getElementById('hintBtn').addEventListener('click', showHint);

    document.getElementById('customizeBtn').addEventListener('click', () => {
        _syncModalFields();
        openModal('customizeModal');
    });

    document.getElementById('soundToggle').addEventListener('click', () => {
        CZ.soundEnabled = !CZ.soundEnabled;
        saveCZ();
        showToast(CZ.soundEnabled ? 'Sound on 🔊' : 'Sound off 🔇');
    });

    // New: Family Trivia Bonus
    document.getElementById('nextMoveBtn').addEventListener('click', () => {
        startTimer();
        openTriviaForHelp();
        onMilestone(G.moves);
    });

    // New: Auto-complete
    document.getElementById('autoCompleteBtn').addEventListener('click', () => {
        if (canAutoComplete()) autoComplete();
        else showJokeBubble("Keep going! Almost ready to auto-complete! 🌟", 2500);
    });

    // ── DRAG & DROP (from drag.js) ──
    document.addEventListener('dragstart',  onDragStart);
    document.addEventListener('dragover',   onDragOver);
    document.addEventListener('dragleave',  onDragLeave);
    document.addEventListener('dragend',    onDragEnd);
    document.addEventListener('drop', (e) => {
        // Patch drop to trigger joke/effects
        e.preventDefault();
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        const pileEl = e.target.closest('.pile, .tableau-pile');
        if (!pileEl || !dragCard) return;

        const dest = pileEl.id;
        const prevDrag = { card: {...dragCard}, src: dragSrc, cards: [...dragCards] };
        const result = moveCards(dragCard, dragSrc, dest);
        onDragEnd();

        if (result) {
            playSound('place');
            resetStockJoke();
            if (dest.startsWith('foundation')) {
                const fi = parseInt(dest.split('-')[1]);
                onFoundationPlace(fi);
                spawnFoundationBurst(dest);
            }
            if (prevDrag.card.value === 'K') onKingMove();
            // Was a face-down card revealed?
            if (dragSrc?.startsWith('tableau')) {
                const pi = parseInt(dragSrc.split('-')[1]);
                // If there's a newly face-up card, trigger flip joke
                if (G.tableau[pi].length > 0 && G.tableau[pi][G.tableau[pi].length-1].faceUp) {
                    onCardFlip();
                }
            }
            onMilestone(G.moves);
            fullRender();
            saveGame();
            flashPile(pileEl);
            if (checkWin()) triggerWin();
        }
    });

    // Click handler (stock + double-click auto-move)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#stock')) {
            _onStockClick();
            return;
        }
        if (e.detail === 2) {
            const cardEl = e.target.closest('.card');
            if (!cardEl || cardEl.classList.contains('face-down')) return;
            const pileEl = cardEl.closest('#waste, [id^=tableau-]');
            if (!pileEl) return;
            const moved = _autoMoveToFoundation(cardEl, pileEl);
            if (!moved) shake(cardEl);
        }
    });

    // Touch
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd);

    // ── MODAL ──
    document.querySelectorAll('.modal-overlay').forEach(ov => {
        ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('active'); });
    });
    document.getElementById('closeCustomize').addEventListener('click',   () => closeModal('customizeModal'));
    document.getElementById('saveSettingsBtn').addEventListener('click',  saveSettingsFromModal);
    document.getElementById('resetSettingsBtn').addEventListener('click', () => { if (confirm('Reset all settings?')) resetCZ(); });

    // Photo upload
    const photoArea  = document.getElementById('photoUploadArea');
    const photoInput = document.getElementById('photoInput');
    photoArea.addEventListener('click', () => photoInput.click());
    photoArea.addEventListener('dragover',  e => { e.preventDefault(); photoArea.classList.add('dragover'); });
    photoArea.addEventListener('dragleave', ()  => photoArea.classList.remove('dragover'));
    photoArea.addEventListener('drop', e => {
        e.preventDefault(); photoArea.classList.remove('dragover');
        handlePhotoFile(e.dataTransfer.files[0]);
    });
    photoInput.addEventListener('change', e => handlePhotoFile(e.target.files[0]));

    // Audio uploads
    ['flip','place','win'].forEach(type => {
        document.getElementById(`audio-btn-${type}`).addEventListener('click', () => document.getElementById(`audio-input-${type}`).click());
        document.getElementById(`audio-input-${type}`).addEventListener('change', e => handleAudioFile(e.target.files[0], type));
        document.getElementById(`test-${type}`)?.addEventListener('click', () => testSound(type));
    });

    // Volume
    document.getElementById('volume-slider').addEventListener('input', e => {
        document.getElementById('volume-value').textContent = e.target.value + '%';
    });

    // Theme
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            CZ.theme = opt.dataset.theme;
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            applyCZ();
        });
    });

    // Victory
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        hideVictory(); stopTimer(); newGame(); resetJokeState(); fullRender(); saveGame();
        showJokeBubble("Let's go again! 🚀", 2000);
    });
    document.getElementById('closeVictory').addEventListener('click', hideVictory);

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (undoMove()) { fullRender(); onUndo(); } else showToast('Nothing to undo.');
        }
        if (e.key === 'h' || e.key === 'H') showHint();
        if (e.key === ' ') { e.preventDefault(); startTimer(); _onStockClick(); }
        if (e.key === 'Escape') { closeModal('customizeModal'); hideVictory(); }
    });
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
(function boot() {
    loadCZ();
    if (!loadGame()) newGame();
    fullRender();
    setupEvents();
    // Welcome joke after 1s
    setTimeout(() => showJokeBubble("Welcome! Good luck, have fun! 🃏♥", 3000), 1000);
})();
