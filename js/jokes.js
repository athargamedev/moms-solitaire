/**
 * jokes.js -- Contextual humor & personality system.
 * Triggered by game events to show family member photos and messages.
 *
 * SOLITAIRE EVENT MAP:
 * ─────────────────────────────────────────────────────────
 * Event              When it fires                    Family popup?
 * ─────────────────────────────────────────────────────────
 * stockSpam          Drawing 3+ cards in a row        Yes (every 3rd draw)
 * foundation         Card placed on foundation        Yes (50% chance)
 * firstAce           First ace ever placed            Always
 * suitComplete       All 13 cards of one suit done    Always + confetti
 * flip               Face-down card revealed          Yes (30% chance)
 * kingMove           King moved to empty column       Yes (70% chance)
 * stuck              Player has no moves / 30s idle   Always
 * undo               Player undoes a move             Always
 * win                All 52 cards on foundations       Always + confetti
 * milestone25        25 moves reached                 Always
 * milestone50        50 moves reached                 Always
 * longGame           10 or 20 minutes played          Always
 * newGame            Fresh game started               Always
 * welcome            Game boots up                    Always
 * ─────────────────────────────────────────────────────────
 */

const JOKES = {
    stockSpam: [
        "Honey, the cards don't change if you keep clicking!",
        "Are we fishing? Because that's a lot of draws!",
        "The stock pile is starting to get dizzy!",
        "Maybe try moving some of those cards first?",
        "At this rate, we'll be here until Christmas!",
        "The cards are getting shy. Maybe a break?",
    ],
    foundation: [
        "That's the way! Perfect!",
        "Foundation power! You're building an empire!",
        "Yesss! Getting closer to victory!",
        "Beautiful move! You're a natural!",
        "Look at you go!",
        "That's my girl!",
        "One more for the pile! You're unstoppable!",
    ],
    firstAce: [
        "First Ace! The foundation has begun! Now we're cooking!",
        "Found an Ace! This is your time to shine!",
        "An Ace! The game is really starting now!",
    ],
    suitComplete: [
        "SUIT COMPLETE! You absolute legend!",
        "The whole suit! One down, three to go! You're amazing!",
        "FULL SUIT! Mom mode: activated!",
    ],
    flip: [
        "What's hiding there?",
        "Ooh, what's under there?!",
        "A mystery card revealed!",
        "The plot thickens...",
        "Surprise!",
        "And the card is...",
    ],
    kingMove: [
        "All hail the King! He found his throne!",
        "The King has arrived! Long may he reign!",
        "A King needs space -- and you gave it to him!",
    ],
    stuck: [
        "Hmm, maybe try drawing from the stock pile?",
        "Tricky spot! Every great player faces challenges!",
        "Use the Hint button -- it's not cheating, it's strategy!",
        "Even grandmasters get stuck sometimes! You've got this!",
        "Try the Undo button and rethink that last move!",
    ],
    milestone25: [
        "25 moves in! You're really getting into it!",
    ],
    milestone50: [
        "50 moves! Dedication level: Expert!",
    ],
    longGame: [
        "10 minutes in! This is a tough one -- you're so patient!",
        "Still going strong! You deserve a coffee after this!",
    ],
    undo: [
        "Wise choice! Every master reconsiders!",
        "Second chances are part of the game!",
        "Take that back! No regrets... well, one regret.",
        "Strategic retreat! Smart!",
    ],
    win: [
        "YOU WON! You absolute champion!",
        "VICTORY! Mom conquers Solitaire again!",
        "WINNER WINNER! You're incredible!",
    ],
    welcome: [
        "Welcome back! Ready for a game?",
        "Good to see you! Let's play!",
        "The cards are waiting for you!",
    ],
    newGame: [
        "Fresh start! Good luck!",
        "New game, new chances! You got this!",
        "Let's do this! Deal those cards!",
    ],
};

// Tracking for contextual triggers
const jokeState = {
    stockDrawsInARow: 0,
    lastFlipJoke: 0,
    lastFoundationJoke: 0,
    acesFound: 0,
    suitsComplete: 0,
    milestonesShown: new Set(),
    totalFoundationMoves: 0,
};

function getJoke(category) {
    const list = JOKES[category];
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
}

// ── TRIGGERED EVENTS ────────────────────────────────────────────────

/**
 * Stock draw -- family member appears every 3rd consecutive draw.
 */
function onStockDraw() {
    jokeState.stockDrawsInARow++;
    if (jokeState.stockDrawsInARow >= 3 && jokeState.stockDrawsInARow % 3 === 0) {
        showCharacterBubble('stockSpam', getJoke('stockSpam'));
    }
}

function resetStockJoke() {
    jokeState.stockDrawsInARow = 0;
}

/**
 * Foundation placement -- family member celebrates.
 * First ace: always. Suit complete: always + confetti.
 * Regular: 50% chance (was 33%).
 * Every 5th foundation move: guaranteed popup.
 */
function onFoundationPlace(foundationIdx) {
    jokeState.totalFoundationMoves++;
    const totalInFoundations = G.foundations.reduce((s, f) => s + f.length, 0);

    // First ace ever
    if (totalInFoundations === 1) {
        showCharacterBubble('firstAce', getJoke('firstAce'), 3500);
        jokeState.acesFound++;
        return;
    }

    // Additional aces (2nd, 3rd, 4th)
    if (G.foundations[foundationIdx].length === 1 && jokeState.acesFound < 4) {
        jokeState.acesFound++;
        showCharacterBubble('firstAce', getJoke('firstAce'), 3000);
        return;
    }

    // Suit complete (13 cards on one foundation)
    if (G.foundations[foundationIdx].length === 13) {
        jokeState.suitsComplete++;
        showCharacterBubble('suitComplete', getJoke('suitComplete'), 4000);
        spawnMiniConfetti();
        return;
    }

    // Every 5th foundation move is guaranteed
    const now = Date.now();
    if (jokeState.totalFoundationMoves % 5 === 0) {
        jokeState.lastFoundationJoke = now;
        showCharacterBubble('foundation', getJoke('foundation'));
        return;
    }

    // Regular foundation praise (50% chance, minimum 4s gap)
    if (now - jokeState.lastFoundationJoke > 4000 && Math.random() < 0.50) {
        jokeState.lastFoundationJoke = now;
        showCharacterBubble('foundation', getJoke('foundation'));
    }
}

/**
 * Card flip -- face-down card revealed. Family member peeks (30% chance).
 */
function onCardFlip() {
    const now = Date.now();
    if (now - jokeState.lastFlipJoke > 6000 && Math.random() < 0.30) {
        jokeState.lastFlipJoke = now;
        showCharacterBubble('flip', getJoke('flip'), 1800);
    }
}

/**
 * King moved to empty column. Family member cheers (70% chance).
 */
function onKingMove() {
    if (Math.random() < 0.70) showCharacterBubble('kingMove', getJoke('kingMove'), 2500);
}

/**
 * Undo move -- family member always reacts.
 */
function onUndo() {
    showCharacterBubble('undo', getJoke('undo'), 2000);
}

/**
 * Move milestones -- family member cheers at 25 and 50 moves.
 */
function onMilestone(moves) {
    if (moves === 25 && !jokeState.milestonesShown.has(25)) {
        jokeState.milestonesShown.add(25);
        showCharacterBubble('milestone25', getJoke('milestone25'), 3000);
    } else if (moves === 50 && !jokeState.milestonesShown.has(50)) {
        jokeState.milestonesShown.add(50);
        showCharacterBubble('milestone50', getJoke('milestone50'), 3000);
    }
}

/**
 * Long game -- family member encourages after 10 and 20 minutes.
 */
function onLongGame(minutes) {
    const key = `long-${minutes}`;
    if (!jokeState.milestonesShown.has(key)) {
        jokeState.milestonesShown.add(key);
        showCharacterBubble('longGame', getJoke('longGame'), 4000);
    }
}

// ── JOKE BUBBLE UI ────────────────────────────────────────────────────────────
let jokeBubbleTimer = null;

function showJokeBubble(text, duration) {
    duration = duration || 2800;
    if (!text) return;
    let bubble = document.getElementById('joke-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'joke-bubble';
        document.body.appendChild(bubble);
    }
    bubble.textContent = text;
    bubble.classList.remove('hide', 'char-bubble');
    bubble.classList.add('show');
    clearTimeout(jokeBubbleTimer);
    jokeBubbleTimer = setTimeout(() => {
        bubble.classList.remove('show');
        bubble.classList.add('hide');
    }, duration);
}

// Small confetti burst (for suit complete)
function spawnMiniConfetti() {
    const colors = ['#c9a55a','#e0bc78','#b85c5c','#7a9e7a','#f0ebe0'];
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti-piece';
            c.style.left = (30 + Math.random() * 40) + 'vw';
            c.style.top  = '-8px';
            c.style.width = c.style.height = (Math.random() * 8 + 4) + 'px';
            c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3200);
        }, i * 20);
    }
}

function resetJokeState() {
    jokeState.stockDrawsInARow = 0;
    jokeState.lastFlipJoke = 0;
    jokeState.lastFoundationJoke = 0;
    jokeState.acesFound = 0;
    jokeState.suitsComplete = 0;
    jokeState.milestonesShown.clear();
    jokeState.totalFoundationMoves = 0;
}
