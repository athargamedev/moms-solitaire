/**
 * jokes.js – Contextual humor & personality system.
 * Triggered by game events to make Mom smile. 😄
 */

const JOKES = {
    // Drawing from stock too many times
    stockSpam: [
        "Honey, the cards don't change if you keep clicking! 😄",
        "Are we fishing? Because that's a lot of draws! 🎣",
        "The stock pile is starting to get dizzy! 🌀",
        "Maybe try moving some of those cards first? Just a thought! 😉",
        "At this rate, we'll be here until Christmas! 🎄",
        "The cards are getting shy. Maybe a break? ☕",
    ],

    // Placing on foundation (rewards)
    foundation: [
        "That's the way! ♥ Perfect!",
        "Foundation power! You're building an empire! 👑",
        "Yesss! Getting closer to victory! 🎯",
        "Beautiful move! You're a natural! 🌟",
        "Look at you go! 🚀",
        "That's my girl! 💪",
        "One more for the pile! You're unstoppable! ⭐",
    ],

    // First ace found
    firstAce: [
        "🅰 First Ace! The foundation has begun! Now we're cooking!",
        "Found an Ace! This is your time to shine! ✨",
        "An Ace! The game is really starting now! 🃏",
    ],

    // Completing a suit
    suitComplete: [
        "🎉 SUIT COMPLETE! You absolute legend!",
        "The whole suit! One down, three to go! You're amazing!",
        "FULL SUIT! 👑 Mom mode: activated!",
    ],

    // Flipping a face-down card
    flip: [
        "What's hiding there?",
        "Ooh, what's under there?!",
        "A mystery card revealed!",
        "The plot thickens... 🎭",
        "Surprise! 🎊",
        "And the card is...",
    ],

    // Moving a King
    kingMove: [
        "👑 All hail the King! He found his throne!",
        "The King has arrived! Long may he reign! 👑",
        "A King needs space — and you gave it to him! 🏰",
    ],

    // No moves available (stuck)
    stuck: [
        "Hmm, maybe try drawing from the stock pile? 🤔",
        "Tricky spot! Every great player faces challenges! 💪",
        "Use the 💡 Hint button — it's not cheating, it's strategy! 😉",
        "Even grandmasters get stuck sometimes! You've got this! 🌟",
        "Try the Undo button and rethink that last move! ↩️",
    ],

    // After 25 moves — encouragement
    milestone25: [
        "25 moves in! You're really getting into it! 🔥",
    ],

    // After 50 moves
    milestone50: [
        "50 moves! Dedication level: Expert! 🏆",
    ],

    // After a long game (10+ minutes)
    longGame: [
        "10 minutes in! This is a tough one — you're so patient! 🌷",
        "Still going strong! You deserve a coffee after this! ☕",
    ],

    // Undo
    undo: [
        "Wise choice! Every master reconsiders! 🧠",
        "Second chances are part of the game! 🔄",
        "Take that back! No regrets... well, one regret. 😄",
        "Strategic retreat! Smart! ↩️",
    ],

    // Win messages
    win: [
        "YOU WON! You absolute champion! 🏆👑🎉",
        "VICTORY! Mom conquers Solitaire again! 🌟🎊",
        "WINNER WINNER! You're incredible! 🎉💪",
    ],
};

// Tracking for contextual triggers
const jokeState = {
    stockDrawsInARow: 0,
    lastFlipJoke: 0,
    acesFound: 0,
    suitsComplete: 0,
    milestonesShown: new Set(),
};

function getJoke(category) {
    const list = JOKES[category];
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
}

// ── TRIGGERED EVENTS ────────────────────────────────────────────────
function onStockDraw() {
    jokeState.stockDrawsInARow++;
    if (jokeState.stockDrawsInARow >= 3 && jokeState.stockDrawsInARow % 3 === 0) {
        showCharacterBubble('stockSpam', getJoke('stockSpam'));
    }
}

function resetStockJoke() {
    jokeState.stockDrawsInARow = 0;
}

function onFoundationPlace(foundationIdx) {
    const totalInFoundations = G.foundations.reduce((s, f) => s + f.length, 0);

    // First ace ever
    if (totalInFoundations === 1) {
        showCharacterBubble('firstAce', getJoke('firstAce'), 3500);
        jokeState.acesFound++;
        return;
    }

    // Suit complete (13 cards on one foundation)
    if (G.foundations[foundationIdx].length === 13) {
        jokeState.suitsComplete++;
        showCharacterBubble('suitComplete', getJoke('suitComplete'), 4000);
        spawnMiniConfetti();
        return;
    }

    // Random foundation praise (1 in 3 chance)
    if (Math.random() < 0.33) {
        showCharacterBubble('foundation', getJoke('foundation'));
    }
}

function onCardFlip() {
    // Show a flip joke 1 in 5 times
    const now = Date.now();
    if (now - jokeState.lastFlipJoke > 8000 && Math.random() < 0.20) {
        jokeState.lastFlipJoke = now;
        showCharacterBubble('flip', getJoke('flip'), 1800);
    }
}

function onKingMove() {
    if (Math.random() < 0.6) showCharacterBubble('kingMove', getJoke('kingMove'), 2500);
}

function onUndo() {
    showCharacterBubble('undo', getJoke('undo'), 2000);
}

function onMilestone(moves) {
    if (moves === 25 && !jokeState.milestonesShown.has(25)) {
        jokeState.milestonesShown.add(25);
        showCharacterBubble('milestone25', getJoke('milestone25'), 3000);
    } else if (moves === 50 && !jokeState.milestonesShown.has(50)) {
        jokeState.milestonesShown.add(50);
        showCharacterBubble('milestone50', getJoke('milestone50'), 3000);
    }
}

function onLongGame(minutes) {
    const key = `long-${minutes}`;
    if (!jokeState.milestonesShown.has(key)) {
        jokeState.milestonesShown.add(key);
        showCharacterBubble('longGame', getJoke('longGame'), 4000);
    }
}

// ── JOKE BUBBLE UI ────────────────────────────────────────────────────────────
let jokeBubbleTimer = null;

function showJokeBubble(text, duration = 2800) {
    if (!text) return;
    let bubble = document.getElementById('joke-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'joke-bubble';
        document.body.appendChild(bubble);
    }
    bubble.textContent = text;
    bubble.classList.remove('hide');
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
    jokeState.acesFound = 0;
    jokeState.suitsComplete = 0;
    jokeState.milestonesShown.clear();
    jokeState.lastFlipJoke = 0;
}
