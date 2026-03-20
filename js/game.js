/**
 * game.js -- Core Klondike Solitaire state, rules, and logic.
 * No DOM access here. Pure state management.
 */

const SUITS  = ['spades', 'hearts', 'diamonds', 'clubs'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED_SUITS = new Set(['hearts', 'diamonds']);

// The live game state object
let G = createInitialState();

// A stack of snapshots for unlimited undo
const undoStack = [];

function createInitialState() {
    return {
        stock:       [],
        waste:       [],
        foundations: [[], [], [], []],   // one per suit in SUITS order
        tableau:     [[], [], [], [], [], [], []],
        moves:       0,
        score:       350,
        time:        0,
        started:     false,
        won:         false,
        // Token economy
        tokens: {
            undo: 0,
            hint: 0,
            peek: 0,
            wand: 0,
            timeFreeze: 0,
            multiplier: 1,
            multiplierMoves: 0
        },
        quizStreak:      0,
        quizzesAnswered: 0,
        quizzesCorrect:  0,
        // Stuck detection
        lastMoveTime:    0,
        stockCycles:     0,
    };
}

function newGame() {
    undoStack.length = 0;
    G = createInitialState();

    const deck = shuffle(buildDeck());
    let idx = 0;

    // Deal tableau: pile i gets i+1 cards, last is face-up
    for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
            const card = deck[idx++];
            card.faceUp = (j === i);
            G.tableau[j].push(card);
        }
    }
    G.stock = deck.slice(idx);
}

function buildDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const value of VALUES)
            deck.push({ suit, value, faceUp: false });
    return deck;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── VALIDATION ───────────────────────────────────────────────────────────────
function canPlaceOnFoundation(card, fIdx) {
    const pile = G.foundations[fIdx];
    if (card.suit !== SUITS[fIdx]) return false;
    if (pile.length === 0) return card.value === 'A';
    const top = pile[pile.length - 1];
    return VALUES.indexOf(card.value) === VALUES.indexOf(top.value) + 1;
}

function canPlaceOnTableau(card, tIdx) {
    const pile = G.tableau[tIdx];
    if (pile.length === 0) return card.value === 'K';
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    const diffColor = RED_SUITS.has(card.suit) !== RED_SUITS.has(top.suit);
    return diffColor && VALUES.indexOf(card.value) === VALUES.indexOf(top.value) - 1;
}

// ── MOVES ─────────────────────────────────────────────────────────────────────
function snapshot() {
    undoStack.push(JSON.stringify(G));
    if (undoStack.length > 100) undoStack.shift();
}

function drawFromStock(onDone) {
    snapshot();
    if (G.stock.length === 0) {
        if (G.waste.length === 0) return false;
        G.stock = G.waste.reverse().map(c => ({ ...c, faceUp: false }));
        G.waste = [];
        G.stockCycles++;
    } else {
        const card = G.stock.pop();
        card.faceUp = true;
        G.waste.push(card);
    }
    G.moves++;
    G.lastMoveTime = G.time;
    onDone?.('flip');
    return true;
}

/** Move 1+ cards.
 * from: 'waste' | 'tableau-N' | 'foundation-N'
 * to:   'foundation-N' | 'tableau-N'
 * Returns 'place' | 'flip' | false
 */
function moveCards(card, from, to) {
    let movedCards = [];
    const fromParts = from.split('-');
    const fromType  = fromParts[0];
    const fromIdx   = parseInt(fromParts[1]);

    // collect cards from source
    if (from === 'waste') {
        if (G.waste.length === 0) return false;
        movedCards = [G.waste[G.waste.length - 1]];
    } else if (fromType === 'tableau') {
        const pile = G.tableau[fromIdx];
        const ci = pile.findIndex(c => c.suit === card.suit && c.value === card.value);
        if (ci < 0) return false;
        movedCards = pile.slice(ci);
    } else if (fromType === 'foundation') {
        const pile = G.foundations[fromIdx];
        movedCards = [pile[pile.length - 1]];
    }

    if (movedCards.length === 0) return false;

    const toParts = to.split('-');
    const toType  = toParts[0];
    const toIdx   = parseInt(toParts[1]);

    // validate
    if (toType === 'foundation') {
        if (movedCards.length !== 1) return false;
        if (!canPlaceOnFoundation(movedCards[0], toIdx)) return false;
    } else if (toType === 'tableau') {
        if (!canPlaceOnTableau(movedCards[0], toIdx)) return false;
    } else return false;

    snapshot();

    // remove from source
    if (from === 'waste') {
        G.waste.pop();
    } else if (fromType === 'tableau') {
        const pile = G.tableau[fromIdx];
        const ci = pile.findIndex(c => c.suit === card.suit && c.value === card.value);
        G.tableau[fromIdx] = pile.slice(0, ci);
        if (G.tableau[fromIdx].length > 0) {
            G.tableau[fromIdx][G.tableau[fromIdx].length - 1].faceUp = true;
        }
    } else if (fromType === 'foundation') {
        G.foundations[fromIdx].pop();
    }

    // add to destination
    if (toType === 'foundation') {
        G.foundations[toIdx].push(...movedCards);
        // Score with multiplier support
        const multiplier = (G.tokens && G.tokens.multiplier > 1) ? G.tokens.multiplier : 1;
        G.score += 10 * multiplier;
        // Tick down the multiplier counter
        if (typeof tickMultiplier === 'function') tickMultiplier();
    } else {
        G.tableau[toIdx].push(...movedCards);
    }

    G.moves++;
    G.lastMoveTime = G.time;
    return 'place';
}

function undoMove() {
    if (undoStack.length === 0) return false;
    G = JSON.parse(undoStack.pop());
    return true;
}

// ── WIN CHECK ─────────────────────────────────────────────────────────────────
function checkWin() {
    return G.foundations.reduce((s, f) => s + f.length, 0) === 52;
}

// ── STUCK CHECK ───────────────────────────────────────────────────────────────
function hasAnyValidMove() {
    // Check waste -> foundation/tableau
    if (G.waste.length > 0) {
        const c = G.waste[G.waste.length - 1];
        for (let i = 0; i < 4; i++) {
            if (canPlaceOnFoundation(c, i)) return true;
        }
        for (let i = 0; i < 7; i++) {
            if (canPlaceOnTableau(c, i)) return true;
        }
    }
    // Check tableau -> foundation or tableau
    for (let i = 0; i < 7; i++) {
        const pile = G.tableau[i];
        if (pile.length === 0) continue;
        const faceUp = pile.filter(c => c.faceUp);
        if (faceUp.length === 0) continue;
        const top = faceUp[faceUp.length - 1];
        for (let j = 0; j < 4; j++) {
            if (canPlaceOnFoundation(top, j)) return true;
        }
        for (let j = 0; j < 7; j++) {
            if (j === i) continue;
            if (canPlaceOnTableau(faceUp[0], j)) return true;
        }
    }
    // Can draw from stock
    if (G.stock.length > 0) return true;
    // Can recycle waste
    if (G.waste.length > 0 && G.stockCycles < 10) return true;
    return false;
}

/**
 * Check if the player seems stuck (no moves for 30+ seconds).
 */
function isPlayerStuck() {
    if (!G.started || G.won) return false;
    return (G.time - G.lastMoveTime) >= 30;
}

// ── HINT ──────────────────────────────────────────────────────────────────────
function findHint() {
    // Waste -> foundation
    if (G.waste.length > 0) {
        const c = G.waste[G.waste.length - 1];
        for (let i = 0; i < 4; i++) {
            if (canPlaceOnFoundation(c, i)) return { from: 'waste', to: `foundation-${i}`, card: c };
        }
        for (let i = 0; i < 7; i++) {
            if (canPlaceOnTableau(c, i)) return { from: 'waste', to: `tableau-${i}`, card: c };
        }
    }
    // Tableau -> foundation or better tableau
    for (let i = 0; i < 7; i++) {
        const pile = G.tableau[i];
        if (pile.length === 0) continue;
        const faceUp = pile.filter(c => c.faceUp);
        if (faceUp.length === 0) continue;
        const top = faceUp[faceUp.length - 1];
        for (let j = 0; j < 4; j++) {
            if (canPlaceOnFoundation(top, j)) return { from: `tableau-${i}`, to: `foundation-${j}`, card: top };
        }
        for (let j = 0; j < 7; j++) {
            if (j === i) continue;
            if (canPlaceOnTableau(faceUp[0], j)) return { from: `tableau-${i}`, to: `tableau-${j}`, card: faceUp[0] };
        }
    }
    return null;
}

/**
 * Multi-move lookahead hint. Tries to find a sequence of 2-3 moves
 * that leads to a foundation placement.
 */
function findDeepHint() {
    // First try the basic hint
    const basic = findHint();
    if (basic && basic.to.startsWith('foundation')) return basic;

    // Try each possible move, then check if the resulting state has a foundation move
    const originalState = JSON.stringify(G);
    const moves = getAllValidMoves();

    for (const move of moves) {
        // Apply the move temporarily
        G = JSON.parse(originalState);
        const result = moveCards(move.card, move.from, move.to);
        if (result) {
            // Check if there is now a foundation move available
            const followUp = findHint();
            if (followUp && followUp.to.startsWith('foundation')) {
                G = JSON.parse(originalState);
                undoStack.pop(); // Remove the snapshot from the temp move
                return move; // Return the first move that leads to a foundation placement
            }
        }
        G = JSON.parse(originalState);
        if (undoStack.length > 0) undoStack.pop();
    }

    G = JSON.parse(originalState);
    return basic; // Fall back to basic hint
}

/**
 * Get all valid moves from the current state.
 */
function getAllValidMoves() {
    const moves = [];

    // Waste moves
    if (G.waste.length > 0) {
        const c = G.waste[G.waste.length - 1];
        for (let i = 0; i < 4; i++) {
            if (canPlaceOnFoundation(c, i)) moves.push({ card: c, from: 'waste', to: `foundation-${i}` });
        }
        for (let i = 0; i < 7; i++) {
            if (canPlaceOnTableau(c, i)) moves.push({ card: c, from: 'waste', to: `tableau-${i}` });
        }
    }

    // Tableau moves
    for (let i = 0; i < 7; i++) {
        const pile = G.tableau[i];
        if (pile.length === 0) continue;
        const faceUp = pile.filter(c => c.faceUp);
        if (faceUp.length === 0) continue;
        const top = faceUp[faceUp.length - 1];
        for (let j = 0; j < 4; j++) {
            if (canPlaceOnFoundation(top, j)) moves.push({ card: top, from: `tableau-${i}`, to: `foundation-${j}` });
        }
        for (let j = 0; j < 7; j++) {
            if (j === i) continue;
            if (canPlaceOnTableau(faceUp[0], j)) moves.push({ card: faceUp[0], from: `tableau-${i}`, to: `tableau-${j}` });
        }
    }

    return moves;
}

// ── SAVE / LOAD ───────────────────────────────────────────────────────────────
const SAVE_KEY = 'momSolitaire_gameState';

function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch(e) {}
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const loaded = JSON.parse(raw);
        // Ensure token state exists even for old saves
        if (!loaded.tokens) {
            loaded.tokens = {
                undo: 0, hint: 0, peek: 0, wand: 0, timeFreeze: 0,
                multiplier: 1, multiplierMoves: 0
            };
        }
        if (loaded.quizStreak === undefined) loaded.quizStreak = 0;
        if (loaded.quizzesAnswered === undefined) loaded.quizzesAnswered = 0;
        if (loaded.quizzesCorrect === undefined) loaded.quizzesCorrect = 0;
        if (loaded.lastMoveTime === undefined) loaded.lastMoveTime = 0;
        if (loaded.stockCycles === undefined) loaded.stockCycles = 0;
        G = loaded;
        return true;
    } catch(e) { return false; }
}
