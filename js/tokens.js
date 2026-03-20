/**
 * tokens.js -- Token Economy System
 * Manages reward tokens earned from quizzes: undo, hint, peek, wand, time freeze, multiplier.
 * Reads/writes G.tokens and G.quizStreak. No DOM access -- rendering is in render.js.
 */

const TOKEN_TYPES = ['undo', 'hint', 'peek', 'wand', 'timeFreeze'];

const STATS_KEY = 'momSolitaire_stats';

// ── PERSISTENT STATS ──────────────────────────────────────────────────────────
let _gameStats = loadStats();

function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
        gamesPlayed: 0,
        gamesWon: 0,
        bestTime: null,
        bestScore: 0,
        quizzesAnswered: 0,
        quizzesCorrect: 0,
        bestStreak: 0,
        tokensEarned: 0,
    };
}

function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(_gameStats)); } catch(e) {}
}

function getStats() { return _gameStats; }

function recordGameStart() {
    _gameStats.gamesPlayed++;
    saveStats();
}

function recordGameWin(time, score) {
    _gameStats.gamesWon++;
    if (_gameStats.bestTime === null || time < _gameStats.bestTime) {
        _gameStats.bestTime = time;
    }
    if (score > _gameStats.bestScore) {
        _gameStats.bestScore = score;
    }
    saveStats();
}

function recordQuizAnswer(correct) {
    _gameStats.quizzesAnswered++;
    if (correct) _gameStats.quizzesCorrect++;
    if (G.quizStreak > _gameStats.bestStreak) {
        _gameStats.bestStreak = G.quizStreak;
    }
    saveStats();
}

// ── TOKEN GRANTING ────────────────────────────────────────────────────────────

/**
 * Grant a token to the player. Returns the token type granted.
 * @param {string} type - one of TOKEN_TYPES
 * @param {number} amount - how many to grant (default 1)
 */
function grantToken(type, amount = 1) {
    if (!G.tokens) return;
    if (type === 'multiplier') {
        G.tokens.multiplier = 2;
        G.tokens.multiplierMoves = 5;
    } else if (G.tokens[type] !== undefined) {
        G.tokens[type] += amount;
    }
    _gameStats.tokensEarned += amount;
    saveStats();
    saveGame();
}

/**
 * Use a token. Returns true if successful (had tokens to spend).
 * @param {string} type - one of TOKEN_TYPES
 */
function useToken(type) {
    if (!G.tokens) return false;
    if (type === 'multiplier') {
        // Multiplier decrements automatically in game.js scoring
        return G.tokens.multiplier > 1;
    }
    if (G.tokens[type] === undefined || G.tokens[type] <= 0) return false;
    G.tokens[type]--;
    saveGame();
    return true;
}

function getTokenCount(type) {
    if (!G.tokens) return 0;
    return G.tokens[type] || 0;
}

function hasToken(type) {
    return getTokenCount(type) > 0;
}

/**
 * Decrement multiplier moves counter. Called after each foundation placement.
 * When it hits zero, multiplier resets to 1.
 */
function tickMultiplier() {
    if (!G.tokens || G.tokens.multiplier <= 1) return;
    G.tokens.multiplierMoves--;
    if (G.tokens.multiplierMoves <= 0) {
        G.tokens.multiplier = 1;
        G.tokens.multiplierMoves = 0;
    }
}

// ── QUIZ REWARD LOGIC ─────────────────────────────────────────────────────────

/**
 * Determine reward for a correct quiz answer based on difficulty and streak.
 * Returns an object: { tokens: [{type, amount}], message: string }
 */
function calculateQuizReward(difficulty) {
    const streak = G.quizStreak || 0;
    const rewards = { tokens: [], message: '' };

    if (difficulty === 'easy') {
        // Easy: 1 undo or 1 hint (random)
        const pick = Math.random() < 0.5 ? 'undo' : 'hint';
        rewards.tokens.push({ type: pick, amount: 1 });
        rewards.message = pick === 'undo' ? 'You earned a free Undo!' : 'You earned a free Hint!';
    } else if (difficulty === 'medium') {
        // Medium: 1 peek or 1 wand
        const pick = Math.random() < 0.5 ? 'peek' : 'wand';
        rewards.tokens.push({ type: pick, amount: 1 });
        rewards.message = pick === 'peek' ? 'You earned a Peek token!' : 'You earned a Magic Wand!';
    } else if (difficulty === 'hard') {
        // Hard: time freeze + guaranteed wand
        rewards.tokens.push({ type: 'timeFreeze', amount: 1 });
        rewards.tokens.push({ type: 'wand', amount: 1 });
        rewards.message = 'Amazing! Time Freeze + Magic Wand!';
    }

    // Streak bonuses
    if (streak >= 3) {
        rewards.tokens.push({ type: 'multiplier', amount: 1 });
        rewards.message += ' + Score Multiplier x2!';
    }
    if (streak >= 5) {
        rewards.tokens.push({ type: 'wand', amount: 1 });
        rewards.message += ' + Bonus Wand!';
    }

    return rewards;
}

/**
 * Apply rewards from a correct quiz answer.
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {{ tokens: Array, message: string }}
 */
function applyQuizReward(difficulty) {
    G.quizStreak = (G.quizStreak || 0) + 1;
    G.quizzesAnswered = (G.quizzesAnswered || 0) + 1;
    G.quizzesCorrect = (G.quizzesCorrect || 0) + 1;

    const rewards = calculateQuizReward(difficulty);
    rewards.tokens.forEach(r => grantToken(r.type, r.amount));

    recordQuizAnswer(true);
    return rewards;
}

/**
 * Record an incorrect quiz answer -- breaks streak.
 */
function recordWrongAnswer() {
    G.quizStreak = 0;
    G.quizzesAnswered = (G.quizzesAnswered || 0) + 1;
    recordQuizAnswer(false);
}

// ── PEEK MECHANIC ─────────────────────────────────────────────────────────────
let _peekMode = false;

function isPeekMode() { return _peekMode; }

function enterPeekMode() {
    if (!useToken('peek')) return false;
    _peekMode = true;
    document.body.classList.add('peek-mode');
    if (typeof showToast === 'function') showToast('Click any face-down card to peek!');
    return true;
}

function exitPeekMode() {
    _peekMode = false;
    document.body.classList.remove('peek-mode');
}

/**
 * Peek at a specific card in the tableau. Shows it for 2 seconds.
 * @param {number} tIdx - tableau pile index
 * @param {number} cIdx - card index within the pile
 */
function peekAtCard(tIdx, cIdx) {
    const pile = G.tableau[tIdx];
    if (!pile || !pile[cIdx] || pile[cIdx].faceUp) return;

    const card = pile[cIdx];
    const overlay = document.getElementById('peekOverlay');
    const peekCard = document.getElementById('peekCard');
    if (!overlay || !peekCard) return;

    const sym = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    peekCard.className = 'peek-card ' + (isRed ? 'red' : 'black');
    peekCard.innerHTML = `<span class="peek-value">${card.value}</span><span class="peek-suit">${sym[card.suit]}</span>`;

    overlay.style.display = 'flex';
    exitPeekMode();

    setTimeout(() => {
        overlay.style.display = 'none';
    }, 2000);
}

// ── TIME FREEZE ───────────────────────────────────────────────────────────────
let _timeFrozen = false;
let _freezeTimer = null;

function isTimeFrozen() { return _timeFrozen; }

function activateTimeFreeze() {
    if (!useToken('timeFreeze')) return false;
    _timeFrozen = true;
    document.body.classList.add('time-frozen');
    if (typeof showToast === 'function') showToast('Time frozen for 30 seconds!');

    clearTimeout(_freezeTimer);
    _freezeTimer = setTimeout(() => {
        _timeFrozen = false;
        document.body.classList.remove('time-frozen');
        if (typeof showToast === 'function') showToast('Time resumed!');
    }, 30000);
    return true;
}

// ── QUIZ COOLDOWN ─────────────────────────────────────────────────────────────
let _lastQuizTime = 0;
const QUIZ_COOLDOWN_MS = 5000; // 5 seconds between voluntary quizzes

function canTriggerQuiz() {
    return Date.now() - _lastQuizTime >= QUIZ_COOLDOWN_MS;
}

function markQuizTriggered() {
    _lastQuizTime = Date.now();
}

function getQuizCooldownRemaining() {
    const remaining = QUIZ_COOLDOWN_MS - (Date.now() - _lastQuizTime);
    return Math.max(0, Math.ceil(remaining / 1000));
}
