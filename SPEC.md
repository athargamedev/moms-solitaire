# Mom's Solitaire - Personalized Card Game

## Concept & Vision

A warm, loving Solitaire experience customized for Mom with her photos on cards and personalized sounds. The interface should feel like a treasured family keepsake—soft, inviting, with gentle animations that make each card movement satisfying. Not a cold game app, but a digital gift that brings joy every time she plays.

**Tone**: Warm, elegant, personal. Like a handcrafted wooden card table passed down through generations.

## Design Language

### Aesthetic Direction
**"Grandma's Parlor"** — Rich, warm tones with subtle floral accents. Soft shadows create depth like cards resting on velvet. The feel of a cozy afternoon game by the window.

### Color Palette
```css
--bg-felt: #2d5a4a;           /* Deep green felt table */
--bg-felt-pattern: #245045;    /* Felt texture darker */
--card-white: #faf8f5;         /* Warm cream card face */
--card-shadow: rgba(0,0,0,0.25);
--accent-gold: #d4a574;        /* Warm gold accents */
--accent-rose: #c17b7b;        /* Soft rose for hearts/diamonds */
--accent-navy: #4a6fa5;        /* Classic navy for spades/clubs */
--text-dark: #3d3d3d;
--text-light: #f5f0e8;
--panel-bg: #faf6f0;           /* Warm off-white panels */
--success-green: #6b9b7a;
```

### Typography
- **Display**: "Playfair Display" (elegant serif for titles, card values)
- **Body**: "Source Sans 3" (warm, readable for UI)
- **Card Values**: "Playfair Display" bold

### Motion Philosophy
- Cards glide smoothly (300ms ease-out) like sliding on felt
- Subtle bounce on card placement (spring effect)
- Gentle pulse on valid moves
- Card flip animation (3D transform)
- Victory celebration with confetti and fanfare

## Layout & Structure

### Main Game View
```
┌─────────────────────────────────────────────────────────┐
│  [🎵] [⚙️ Customize]              Solitaire    [↻][❓] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   [Stock] [Waste]          [♠] [♥] [♦] [♣]             │
│                           Foundation piles              │
│                                                         │
│   [Pile 1] [Pile 2] [Pile 3] [Pile 4] [Pile 5] [Pile 6] [Pile 7]   │
│   (Tableaus)                                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│   Moves: 42    Time: 05:23    Score: 1250    [Hint]    │
└─────────────────────────────────────────────────────────┘
```

### Customization Panel (Modal Overlay)
```
┌─────────────────────────────────────────────────────────┐
│              ✨ Customize Your Game ✨                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  CARD PERSONALIZATION                            │   │
│  │  ────────────────────────                        │   │
│  │  [Upload Photo] Drag & drop or click to browse   │   │
│  │                                                 │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │   │
│  │  │ A♥  │ │ K♠  │ │ Q♦  │ │ J♣  │  Preview    │   │
│  │  └─────┘ └─────┘ └─────┘ └─────┘               │   │
│  │                                                 │   │
│  │  Preview text on cards: [Your Name Here    ]   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  SOUND SETTINGS                                  │   │
│  │  ────────────────────────                        │   │
│  │  🎵 Card flip:     [Dropdown ▼] [▶ Test]        │   │
│  │  🎵 Card place:    [Dropdown ▼] [▶ Test]        │   │
│  │  🎵 Win fanfare:   [Dropdown ▼] [▶ Test]        │   │
│  │  🔊 Master Volume: ═══════════●═══ 75%          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Reset to Default]              [Save & Play]          │
└─────────────────────────────────────────────────────────┘
```

## Features & Interactions

### Core Gameplay
- **Klondike Solitaire** rules (standard 52-card game)
- Click stock to draw cards to waste pile
- Drag-and-drop cards between piles
- Double-click to auto-move to foundation
- Undo moves (unlimited)
- Hint system (highlights valid moves)
- New game / Restart options

### Card Customization
- Upload personal photo to appear on card backs
- Photo gets tile-scaled to fill card back
- Custom text appears on card corners (e.g., "With love from Andre")
- Multiple photo slots for variety (assign different photos to different cards)
- Preview shows live updates

### Sound Customization
- Preset sounds: Classic click, Soft thud, Playful pop
- Upload custom sounds (MP3/WAV)
- Volume control
- Mute option
- Test button for each sound

### Persistence
- LocalStorage saves:
  - Custom photos (base64)
  - Custom sounds (base64)
  - Current game state
  - High scores
  - Sound preferences

## Component Inventory

### Card Component
- **Default**: Cream background, suit color, elegant typography
- **Hover**: Slight lift (translateY -2px), enhanced shadow
- **Dragging**: Larger shadow, slight rotation, 1.05 scale
- **Flipping**: 3D rotate animation, back → face
- **Card Back**: Photo pattern or classic design with personalization

### Button Component
- **Primary**: Gold accent, rounded corners (8px)
- **Hover**: Brightness increase, subtle glow
- **Active**: Scale 0.98
- **Disabled**: Desaturated, 50% opacity

### Modal/Panel
- Semi-transparent dark overlay
- Centered panel with warm background
- Smooth fade-in (300ms)
- Close on overlay click or X button

### Score Display
- Timer counting up
- Move counter
- Score (optional: Vegas scoring)
- Subtle styling, doesn't distract from game

## Technical Approach

### Single HTML File
- All CSS in `<style>` tag
- All JS in `<script>` tag
- Base64-encoded assets for portability
- No external dependencies except Google Fonts CDN
- Works offline once loaded

### Card Generation
- CSS-based card rendering
- Photo applied as background-image with cover fit
- Canvas fallback for complex photo manipulation
- SVG patterns for card backs when no photo

### Sound Handling
- Web Audio API for sound playback
- Audio context with volume control
- Preload sounds on first interaction
- Fallback for browsers with autoplay restrictions

### Drag & Drop
- Native HTML5 drag-and-drop
- Touch support for mobile/tablet
- Visual feedback during drag
- Drop zone highlighting

### Game State
- JSON serialization of game state
- LocalStorage persistence
- Auto-save after each move
- Export/import game for backup
