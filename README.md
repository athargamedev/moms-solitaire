# Mom's Solitaire ♥

A beautiful, fully personalized **Klondike Solitaire** game built as a single local web app — no server, no installation, no internet required. Just open `index.html` in any browser and play!

Originally built as a gift, with customizable card backs (family photos!), personal messages, custom sounds, theme options, and a warm personality that cheers you on as you play.

---

## 🎮 Features

### Gameplay
- **Standard Klondike Solitaire rules** — draw one from stock, alternating colors on tableau, suit sequence on foundations
- **Unlimited Undo** — full undo stack, up to 100 moves deep
- **Smart Hint system** — highlights the card and destination pile
- **🤖 Play Next Move** — finds and executes the best valid move automatically
- **🪄 Auto-Complete** — cascades all cards to foundations once the game is trivially solvable
- **Double-click** any card to instantly move it to its foundation
- **Touch support** — works on tablets and phones
- **Keyboard shortcuts**: `Ctrl+Z` undo · `H` hint · `Space` draw

### Visual Effects
- Particle burst on every foundation placement
- 140-piece confetti on victory
- Progress bar showing % of cards in foundations
- Card shake on invalid moves · Pile glow pulse on valid drops
- Smooth card flip, deal, and landing animations

### Personality & Humor 😄
Contextual funny messages appear during gameplay:
- Click the stock pile too many times: *"Honey, the cards don't change if you keep clicking!"*
- First Ace found: *"First Ace! The foundation has begun! Now we're cooking!"*
- Complete a full suit: *"SUIT COMPLETE! You absolute legend!"*
- Move a King: *"All hail the King! He found his throne!"* 👑
- 25 / 50 move milestones · Win quotes · Undo quips

### ✨ Customization Panel
- **Card back photo** — upload any family photo (JPG/PNG, drag & drop)
- **Personal message** — shown on every card back (e.g., "With love ♥")
- **Background themes** — Classic, Forest, Ocean, Autumn, Violet
- **Sound personalization** — choose preset sounds or upload your own MP3/OGG for card flip, card place, and win fanfare
- **Volume control** and sound toggle
- All settings **persist** via `localStorage` — your customizations survive page refreshes

---

## 📁 File Structure

```
Solitaire/
├── index.html              ← HTML structure only
├── css/
│   ├── style.css           ← variables, layout, themes, progress bar, joke bubble
│   ├── cards.css           ← card face/back, flip, photo support
│   ├── modal.css           ← customization panel, sound settings, victory screen
│   └── animations.css      ← all @keyframes: deal, flip, confetti, shake, burst
└── js/
    ├── game.js             ← Klondike rules, state, undo stack, hint engine, save/load
    ├── render.js           ← DOM rendering (cards, piles, stats)
    ├── drag.js             ← HTML5 drag & drop + touch support
    ├── sounds.js           ← Web Audio API engine + custom audio playback
    ├── customize.js        ← CZ settings object, photo/audio uploads, localStorage
    ├── jokes.js            ← Contextual humor system (30+ messages, event-triggered)
    ├── autoplay.js         ← Play Next Move, Auto-Complete, foundation burst FX
    └── main.js             ← Entry point: event wiring, timer, confetti, victory
```

---

## 🚀 How to Run

1. Download or clone this repo
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
3. Play! No setup required.

```bash
git clone https://github.com/YOUR_USERNAME/moms-solitaire.git
cd moms-solitaire
# open index.html in your browser
```

---

## 🎨 Customizing for Your Own Family

1. Click **✨ Customize** in the top-left header
2. Upload a family photo for the card back
3. Type a personal message (e.g., *"Love you Mom! ♥"*)
4. Choose your favorite table theme
5. Optionally upload your own audio for card sounds
6. Hit **Save & Play** — your settings are saved for next time!

---

## 🛠 Tech Stack

- **Vanilla HTML5 / CSS3 / JavaScript** — zero dependencies, zero build tools
- **Web Audio API** — generated sounds + custom audio playback
- **HTML5 Drag & Drop API** — with touch fallback
- **localStorage** — persists all customization settings locally
- **Google Fonts** — Playfair Display + Source Sans 3 (loaded via CDN)

> ⚠️ Game requires an internet connection **only** to load Google Fonts. Everything else works fully offline.

---

## 📸 Screenshots

> The card backs show a custom family photo and personal message — exactly as your mother uploaded them.

---

## 📜 License

MIT — do whatever you like with it. Made with love. ♥
