/**
 * customize.js – Manages all personalization settings.
 * CZ is the single source of truth for customization.
 */

const CZ_KEY = 'momSolitaire_customization';

let CZ = defaultCZ();

function defaultCZ() {
    return {
        cardPhoto:   null,           // base64 image for card back
        cardMessage: 'With love ♥', // text on card back
        theme:       'classic',      // body theme class
        sounds: {
            flip:  'soft',
            place: 'soft',
            win:   'fanfare',
        },
        customAudio: {
            flip:  null,
            place: null,
            win:   null,
        },
        volume:       0.75,
        soundEnabled: true,
    };
}

// ── LOAD / SAVE ───────────────────────────────────────────────────────────────
function loadCZ() {
    try {
        const raw = localStorage.getItem(CZ_KEY);
        if (raw) CZ = { ...defaultCZ(), ...JSON.parse(raw) };
    } catch(e) { CZ = defaultCZ(); }
    applyCZ();
}

function saveCZ() {
    try { localStorage.setItem(CZ_KEY, JSON.stringify(CZ)); } catch(e) {}
    applyCZ();
}

// ── APPLY ─────────────────────────────────────────────────────────────────────
function applyCZ() {
    // Theme
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${CZ.theme}`);

    // Sound toggle button
    document.getElementById('soundToggle').textContent = CZ.soundEnabled ? '🔊' : '🔇';

    // Sync modal fields if modal exists
    _syncModalFields();
}

function _syncModalFields() {
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    safeSet('cz-message',     CZ.cardMessage);
    safeSet('sound-flip',     CZ.sounds.flip);
    safeSet('sound-place',    CZ.sounds.place);
    safeSet('sound-win',      CZ.sounds.win);
    safeSet('volume-slider',  Math.round(CZ.volume * 100));
    const vv = document.getElementById('volume-value');
    if (vv) vv.textContent = Math.round(CZ.volume * 100) + '%';

    // Theme selection
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.theme === CZ.theme);
    });

    // Photo preview
    const prev = document.getElementById('photo-preview-area');
    if (prev) {
        if (CZ.cardPhoto) {
            prev.innerHTML = `
                <div class="photo-item">
                    <img src="${CZ.cardPhoto}" class="photo-preview selected" alt="Card back photo">
                    <button class="photo-remove" id="removePhoto" title="Remove photo">×</button>
                </div>`;
            document.getElementById('removePhoto')?.addEventListener('click', () => {
                CZ.cardPhoto = null;
                saveCZ();
                renderAll();
            });
        } else {
            prev.innerHTML = '';
        }
    }

    // Audio labels
    ['flip','place','win'].forEach(t => {
        const lbl = document.getElementById(`audio-label-${t}`);
        if (lbl) lbl.textContent = CZ.customAudio[t] ? '✅ Custom loaded' : '';
    });
}

// ── PHOTO UPLOAD ──────────────────────────────────────────────────────────────
function handlePhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    if (file.size > 6 * 1024 * 1024) { showToast('Image too large (max 6 MB).'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        CZ.cardPhoto = e.target.result;
        saveCZ();
        renderAll();
        showToast('Photo applied to card backs! 🃏');
    };
    reader.readAsDataURL(file);
}

// ── AUDIO UPLOAD ──────────────────────────────────────────────────────────────
function handleAudioFile(file, type) {
    if (!file || !file.type.startsWith('audio/')) { showToast('Please select an audio file.'); return; }
    if (file.size > 6 * 1024 * 1024) { showToast('Audio too large (max 6 MB).'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        CZ.customAudio[type] = e.target.result;
        CZ.sounds[type] = 'custom';
        saveCZ();
        showToast(`Custom ${type} sound uploaded! 🎵`);
    };
    reader.readAsDataURL(file);
}

// ── SAVE FROM MODAL ───────────────────────────────────────────────────────────
function saveSettingsFromModal() {
    const get = id => document.getElementById(id);
    CZ.cardMessage  = get('cz-message')?.value || '';
    CZ.sounds.flip  = get('sound-flip')?.value  || 'soft';
    CZ.sounds.place = get('sound-place')?.value || 'soft';
    CZ.sounds.win   = get('sound-win')?.value   || 'fanfare';
    CZ.volume       = (parseInt(get('volume-slider')?.value) || 75) / 100;
    saveCZ();
    renderAll();
    closeModal('customizeModal');
    showToast('Settings saved! ✨');
}

function resetCZ() {
    CZ = defaultCZ();
    saveCZ();
    renderAll();
    showToast('Settings reset to defaults.');
}
