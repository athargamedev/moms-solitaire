/**
 * sounds.js – Web Audio API–based sound engine.
 * Generated sounds + support for custom uploaded audio.
 */

let _ctx = null;

function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

// ── MAIN PLAY FUNCTION ────────────────────────────────────────────────────────
function playSound(type) {
    if (!CZ.soundEnabled) return;

    const soundId = CZ.sounds[type];
    if (!soundId || soundId === 'none') return;

    // Custom uploaded audio
    if (soundId === 'custom' && CZ.customAudio[type]) {
        const audio = new Audio(CZ.customAudio[type]);
        audio.volume = CZ.volume;
        audio.play().catch(() => _generateSound(type));
        return;
    }
    _generateSound(type);
}

function _generateSound(type) {
    const ctx = getCtx();
    const vol = CZ.volume;
    const soundId = CZ.sounds[type];

    switch (type) {
        case 'flip':
            if (soundId === 'soft')    _tone(ctx, 820,  'sine',     vol * 0.28, 0.09);
            else if (soundId === 'classic') _tone(ctx, 1200, 'square', vol * 0.18, 0.05);
            else if (soundId === 'snap')    _tone(ctx, 2000, 'sawtooth', vol * 0.12, 0.03);
            break;

        case 'place':
            if (soundId === 'soft')   _tone(ctx, 280,  'sine',     vol * 0.40, 0.13);
            else if (soundId === 'thud')   _tone(ctx, 180,  'triangle', vol * 0.50, 0.10);
            else if (soundId === 'wood')   _tone(ctx, 140,  'sawtooth', vol * 0.30, 0.08);
            break;

        case 'win':
            if (soundId === 'fanfare')  _fanfare(ctx, vol);
            else if (soundId === 'bells')    _bells(ctx, vol);
            else if (soundId === 'applause') _noise(ctx, vol);
            break;
    }
}

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
function _tone(ctx, freq, type, gain, duration) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

function _fanfare(ctx, vol) {
    [[523,0],[659,0.14],[784,0.28],[1047,0.42],[784,0.56],[1047,0.70]].forEach(([f,t]) => {
        setTimeout(() => _tone(ctx, f, 'sine', vol * 0.30, 0.38), t * 1000);
    });
}

function _bells(ctx, vol) {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => _tone(ctx, 700 + Math.random() * 500, 'sine', vol * 0.18, 0.28), i * 90);
    }
}

function _noise(ctx, vol) {
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(vol * 0.45, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    src.start();
    src.stop(ctx.currentTime + 1.5);
}

// Test a sound from the modal (previews the selection in the dropdown)
function testSound(type) {
    const sel = document.getElementById(`sound-${type}`);
    const prev = CZ.sounds[type];
    CZ.sounds[type] = sel ? sel.value : prev;
    playSound(type);
    CZ.sounds[type] = prev;
}
