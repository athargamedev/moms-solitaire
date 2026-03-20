/**
 * main.js -- App entry point: wires up all modules.
 * Load order: game.js -> customize.js -> sounds.js -> jokes.js -> characters.js
 *             -> tokens.js -> autoplay.js -> quizzes.js -> render.js -> drag.js -> main.js
 */

// ── TIMER ─────────────────────────────────────────────────────────────────────
let _timerInterval = null;

function startTimer() {
    if (G.started || G.won) return;
    G.started = true;
    _timerInterval = setInterval(() => {
        // Time freeze support
        if (typeof isTimeFrozen === 'function' && isTimeFrozen()) {
            updateStats();
            return;
        }
        G.time++;
        updateStats();
        // Long game jokes
        if (G.time === 600)  onLongGame(10);
        if (G.time === 1200) onLongGame(20);
        // Milestone checks
        onMilestone(G.moves);
        // Auto quiz triggers (check every 5 seconds to avoid spam)
        if (G.time % 5 === 0 && typeof checkAutoQuizTriggers === 'function') {
            checkAutoQuizTriggers();
        }
        // Stock exhaustion check
        if (typeof checkStockExhaustion === 'function') checkStockExhaustion();
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
    showCharacterBubble('win', getJoke('win'), 5000);

    // Record stats
    if (typeof recordGameWin === 'function') recordGameWin(G.time, G.score);

    setTimeout(() => showVictory(), 800);
    spawnConfetti();
}

function showVictory() {
    const el = document.getElementById('victoryOverlay');
    el.querySelector('#victory-stats').innerHTML =
        `🏆 ${G.moves} moves &nbsp;|&nbsp; ⏱ ${document.getElementById('timeDisplay').textContent} &nbsp;|&nbsp; ⭐ ${G.score} pts`;

    // Render extra victory info
    if (typeof renderVictoryExtras === 'function') renderVictoryExtras();

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

    // Use deep hint for better suggestions
    const hint = (typeof findDeepHint === 'function') ? findDeepHint() : findHint();
    if (!hint) {
        showCharacterBubble('stuck', getJoke('stuck'), 3000);
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
    showToast('Try that highlighted card!');
}

/**
 * Use a hint token for a free hint. Returns true if token was spent.
 */
function useHintToken() {
    if (typeof useToken === 'function' && hasToken('hint')) {
        useToken('hint');
        showHint();
        if (typeof renderTokenBar === 'function') renderTokenBar();
        return true;
    }
    return false;
}

// ── TOKEN UNDO ────────────────────────────────────────────────────────────────
function useUndoToken() {
    if (typeof useToken === 'function' && hasToken('undo')) {
        useToken('undo');
        if (undoMove()) {
            fullRender();
            onUndo();
            showToast('Free undo used!');
            if (typeof renderTokenBar === 'function') renderTokenBar();
            return true;
        }
    }
    return false;
}

// ── OVERRIDDEN DRAG.JS EVENTS (wired to joke system) ─────────────────────────
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

            // Check suit completion
            if (typeof checkSuitComplete === 'function' && checkSuitComplete(i)) {
                showCharacterBubble('suitComplete', getJoke('suitComplete'), 4000);
                // Trigger a bonus hard quiz for suit completion
                if (typeof checkMilestoneQuiz === 'function') {
                    setTimeout(() => checkMilestoneQuiz(), 2000);
                }
            }

            // Check milestone quiz triggers
            if (typeof checkMilestoneQuiz === 'function') checkMilestoneQuiz();

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
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            if (confirm('Nova partida? Todo o progresso atual sera perdido.')) {
                hideVictory();
                stopTimer();
                newGame();
                resetJokeState();
                if (typeof recordGameStart === 'function') recordGameStart();
                fullRender();
                saveGame();
                // Pick a fresh character to welcome Mom
                showCharacterBubble('flip', "Nova partida! Boa sorte, Mae!", 3000);
            }
        });
    }

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
        showToast(CZ.soundEnabled ? 'Sound on' : 'Sound off');
    });

    // Family Trivia Bonus (brain button)
    document.getElementById('nextMoveBtn').addEventListener('click', () => {
        startTimer();
        if (typeof openTriviaForHelp === 'function') {
            openTriviaForHelp('easy', false);
        }
        onMilestone(G.moves);
    });

    // Auto-complete
    document.getElementById('autoCompleteBtn').addEventListener('click', () => {
        if (canAutoComplete()) autoComplete();
        else showCharacterBubble('stuck', "Keep going! Almost ready to auto-complete!", 2500);
    });


    // Stats button
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            if (typeof renderStatsModal === 'function') renderStatsModal();
            openModal('statsModal');
        });
    }

    // ── TOKEN BAR CLICKS ──
    const tokenUndo = document.getElementById('token-undo');
    if (tokenUndo) tokenUndo.addEventListener('click', () => useUndoToken());

    const tokenHint = document.getElementById('token-hint');
    if (tokenHint) tokenHint.addEventListener('click', () => useHintToken());

    const tokenPeek = document.getElementById('token-peek');
    if (tokenPeek) tokenPeek.addEventListener('click', () => {
        if (typeof enterPeekMode === 'function') enterPeekMode();
    });

    const tokenWand = document.getElementById('token-wand');
    if (tokenWand) tokenWand.addEventListener('click', () => {
        if (typeof useWandToken === 'function') useWandToken();
    });

    // ── DRAG & DROP (from drag.js) ──
    document.addEventListener('dragstart',  onDragStart);
    document.addEventListener('dragover',   onDragOver);
    document.addEventListener('dragleave',  onDragLeave);
    document.addEventListener('dragend',    onDragEnd);
    document.addEventListener('drop', (e) => {
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

                // Check suit completion
                if (typeof checkSuitComplete === 'function' && checkSuitComplete(fi)) {
                    showCharacterBubble('suitComplete', getJoke('suitComplete'), 4000);
                }

                // Milestone quiz
                if (typeof checkMilestoneQuiz === 'function') checkMilestoneQuiz();
            }
            if (prevDrag.card.value === 'K') onKingMove();
            if (dragSrc?.startsWith('tableau')) {
                const pi = parseInt(dragSrc.split('-')[1]);
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

    // Click handler (stock + double-click auto-move + peek mode)
    document.addEventListener('click', (e) => {
        // Peek mode: clicking a face-down card peeks at it
        if (typeof isPeekMode === 'function' && isPeekMode()) {
            const cardEl = e.target.closest('.card.face-down');
            if (cardEl) {
                const pileEl = cardEl.closest('[id^=tableau-]');
                if (pileEl) {
                    const tIdx = parseInt(pileEl.id.split('-')[1]);
                    const cards = Array.from(pileEl.querySelectorAll('.card'));
                    const cIdx = cards.indexOf(cardEl);
                    if (typeof peekAtCard === 'function') peekAtCard(tIdx, cIdx);
                    e.stopPropagation();
                    return;
                }
            }
            // Clicked something else while in peek mode -- cancel
            if (typeof exitPeekMode === 'function') exitPeekMode();
        }

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
        hideVictory(); stopTimer(); newGame(); resetJokeState();
        if (typeof recordGameStart === 'function') recordGameStart();
        fullRender(); saveGame();
        showCharacterBubble('firstAce', "Let's go again!", 2000);
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
        if (e.key === 'Escape') {
            closeModal('customizeModal');
            closeModal('statsModal');
            if (typeof closeTrivia === 'function') closeTrivia();
            if (typeof closeBirthday === 'function') closeBirthday();
            hideVictory();
            if (typeof exitPeekMode === 'function') exitPeekMode();
        }
        // Q key for quick quiz
        if (e.key === 'q' || e.key === 'Q') {
            startTimer();
            if (typeof openTriviaForHelp === 'function') openTriviaForHelp('easy', false);
        }
    });
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
(function boot() {
    loadCZ();
    if (!loadGame()) {
        newGame();
        if (typeof recordGameStart === 'function') recordGameStart();
    }
    fullRender();
    setupEvents();

    // Welcome message after 1s
    setTimeout(() => showCharacterBubble('flip', 'Welcome! Good luck, have fun!', 3000), 1000);

    // Birthday check after characters load (give it time to fetch roster.json)
    setTimeout(() => {
        if (typeof isBirthdayToday === 'function' && isBirthdayToday()) {
            showBirthdayGreeting();
        }
    }, 2000);
})();
