# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step. Open `index.html` directly in any modern browser:

```bash
# macOS/Linux
open index.html

# Windows
start index.html
```

The `admin.html` page is a separate entry point for managing family characters — accessible from the main game header or directly in the browser.

## Architecture

This is a **zero-dependency, no-build vanilla JS/CSS/HTML** app. No npm, no bundler, no framework.

### Module Load Order

`index.html` loads scripts in strict dependency order (defined at bottom of `<body>`):

```
game.js → customize.js → sounds.js → jokes.js → autoplay.js → render.js → drag.js → characters.js → main.js
```

`main.js` is the entry point that wires everything together. All modules expose globals — there is no ES module system.

### Key Architectural Boundaries

| File | Responsibility | Key Rule |
|------|---------------|----------|
| `js/game.js` | Klondike rules, state `G`, undo stack | **No DOM access** — pure logic only |
| `js/render.js` | Full DOM re-render from `G` | Stateless; called after every state change |
| `js/drag.js` | HTML5 drag & drop + touch fallback | Reads `G`, calls game functions, then `fullRender()` |
| `js/main.js` | Event wiring, timer, win flow, confetti | Orchestrates all other modules |
| `js/customize.js` | Settings object `CZ`, photo/audio uploads, localStorage | All user preferences live here |
| `js/sounds.js` | Web Audio API engine + custom audio | Called via `playSound(type)` |
| `js/jokes.js` | Event-triggered humor messages (English) | Exposes `getJoke(event)`, `onMilestone()`, etc. |
| `js/characters.js` | Family character speech bubbles (Portuguese) | Falls back to `jokes.js` when no characters registered |
| `js/autoplay.js` | Play Next Move, Auto-Complete logic, foundation burst FX | Reads `G`, mutates via game functions |

### State Management

- The entire game state lives in the global `G` object (`game.js`).
- Every move: snapshot `G` → push to `undoStack` → mutate `G` → call `fullRender()`.
- All user settings persist in `localStorage` via `CZ` (the customize settings object in `customize.js`).

### Characters System

`admin.html` + `js/characters.js` implement a family character system:
- Characters stored in `localStorage` under key `momSolitaire_characters`.
- Each character has a name, relation, photo (base64), personality preset (`funny`/`sweet`/`wise`/`energetic`), and custom message overrides.
- During gameplay, characters show as speech bubbles triggered by game events (foundation placement, stuck, win, etc.).
- Selection mode: `random`, `roundrobin`, or `single:<id>` — stored under `momSolitaire_charMode`.
- Falls back gracefully to the English `jokes.js` system when no characters are registered.
- Character photos can also be stored as files in `characters/<slug>/<slug>.png` (used by the four pre-seeded family members).

### CSS Structure

- `css/style.css` — CSS variables, layout, themes (5 color themes via `body.theme-*`), progress bar, joke bubble
- `css/cards.css` — card face/back styling, photo card back support
- `css/modal.css` — customization panel, victory screen
- `css/animations.css` — all `@keyframes`: deal, flip, confetti, shake, particle burst
- `css/admin.css` — admin panel only (not loaded by `index.html`)

## Product Roadmap (context for future work)

Three major features are planned for turning this into a scalable "Solitaire with the Family" product:
1. **Facebook Scraping**: Auto-populate characters from FB profile photos.
2. **In-Game Family Quizzes**: Family members pop up with trivia; correct answers grant undo tokens or magic wand moves.
3. **Family Contribution Portal**: Cloud backend (Supabase/Firebase) so family members can self-serve their character data via a shareable link, replacing localStorage with a unique Game ID payload.
