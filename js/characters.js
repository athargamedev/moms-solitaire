/**
 * characters.js – Family Character Engine
 * Loads registered family members and shows their photo + message
 * as rich speech bubbles during gameplay.
 *
 * Falls back gracefully to the original JOKES system when no
 * characters are registered.
 */

const CHAR_KEY  = 'momSolitaire_characters';
const CHAR_MODE = 'momSolitaire_charMode';  // 'random' | 'roundrobin' | 'single:id'

// ── PERSONALITY PRESET MESSAGES ──────────────────────────────────────────────
const PERSONALITY_PRESETS = {
    funny: {
        stockSpam:    ["Mãe, os cards não mudam de cor não! 😄", "Tá pescando? Que puxada! 🎣", "O baralho tá ficando zonzo! 🌀"],
        foundation:   ["É isso aí! Bora lá! 🚀", "Olha só que jogada! 👏", "Tá na veia hein! 💪"],
        firstAce:     ["PRIMEIRO ÁS! A festa começou! 🎉", "Achei um Ás! Agora vai! ✨"],
        suitComplete: ["NÃO ACREDITO! Você é absurda! 🎊", "Naipe completo! Lenda total! 👑"],
        flip:         ["Oi, o que tem aí? 👀", "Que carta surpresa! 🎭", "Vamos ver..."],
        kingMove:     ["O Rei chegou! 👑 Majestade!", "Rei no trono! Minha rainha! 🏰"],
        stuck:        ["Psiu, usa a dica ali ó! 💡😉", "Calma, toda campeã fica presa às vezes! 🌟"],
        undo:         ["Boa! Segunda chance! 🔄", "Voltou! Pensa melhor agora! 🧠"],
        win:          ["GANHOU! Eu SABIA! Te amo demais! ❤️🏆", "VITÓRIA! Minha rainha do baralho! 👑🎉"],
        milestone25:  ["25 jogadas! Muito bem! 🔥"],
        milestone50:  ["50 jogadas! Dedicação de campeã! 🏆"],
        longGame:     ["10 minutinhos! Que paciência, hein! ☕"],
    },
    sweet: {
        stockSpam:    ["Amor, que tal mover alguma carta primeiro? 💕", "Com calma, você chega lá! 🌷"],
        foundation:   ["Perfeito! Que jogada linda! 🌸", "Amo ver você jogar assim! ❤️", "Que orgulho! 🥰"],
        firstAce:     ["Ás! Agora sim, meu amor! ✨", "Encontrou! Você é incrível! 💖"],
        suitComplete: ["Naipe completo! Que beleza! 🌺 Te amo!", "Perfeita! Minha estrela! ⭐💕"],
        flip:         ["Curiosidade gostosa! 🌼", "O que virá? 😊"],
        kingMove:     ["O Rei do seu coração! 👑💕", "Rei no lugar certo! Maravilhosa! 🌹"],
        stuck:        ["Vai com calma, você consegue! 💪🌷", "Cada jogada importa! Vai! 🌟"],
        undo:         ["Certinho! Pensa com carinho! 💕", "Ótima decisão, querida! 🌸"],
        win:          ["GANHOU! Que amor! Te amo tanto! ❤️🎉", "Vitória merecida! Você brilha! 🌟💕"],
        milestone25:  ["25 jogadas cheias de amor! 🌷"],
        milestone50:  ["50 jogadas! Que dedicação linda! 💖"],
        longGame:     ["10 minutinhos de pura alegria! ☕🌸"],
    },
    coach: {
        stockSpam:    ["FOCO! Analise as opções! 👊", "Estratégia! Não desanima! 💪"],
        foundation:   ["ISSO! BORA! 🚀", "Excelente execução! ⚡", "ATAQUE! Continua assim! 🔥"],
        firstAce:     ["ÁS! PARTIU FUNDAÇÃO! 💥", "VAMOS! Base construída! 💪"],
        suitComplete: ["NAIPE INTEIRO! CAMPEÃ! 🏆🔥", "DESTRUINDO O JOGO! Isso é sangue frio! 💪👊"],
        flip:         ["Mais uma peça! Avança! ⚡", "INFORMAÇÃO! Usa! 🎯"],
        kingMove:     ["REI DEPLOYADO! Excelente posição! 👑⚡", "Abre espaço! Tática perfeita! 🏰"],
        stuck:        ["RESPIRA! Analisa e ataca! 💡", "Dificuldade é treino! Você aguenta! 💪🔥"],
        undo:         ["RESET TÁTICO! Recalcula e vai! ↩️⚡", "Bom ajuste! Segue em frente! 🎯"],
        win:          ["CAMPEÃ ABSOLUTA! 🏆🔥 Isso é mentalidade!", "VITÓRIA! MODO BEAST ATIVADO! 💪👑"],
        milestone25:  ["25 MOVIMENTOS! RITMO! 🔥"],
        milestone50:  ["50 MOVIMENTOS! MÁQUINA! 💪⚡"],
        longGame:     ["10 MINUTOS! RESISTÊNCIA DE FERRO! ☕💪"],
    },
    wise: {
        stockSpam:    ["Às vezes a pausa revela o caminho. 🍃", "Observe as colunas antes de agir. 🧘"],
        foundation:   ["Cada carta no lugar certo. Harmonia. 🌿", "Bem jogado, com sabedoria. ✨"],
        firstAce:     ["O primeiro passo de uma longa jornada. 🌅", "As fundações começam com um Ás. 🌱"],
        suitComplete: ["Naipe completo. Equilíbrio alcançado. 🍀", "Persistência e sabedoria. Belo resultado. 🌿"],
        flip:         ["O desconhecido se revela. 🌙", "Cada carta contém possibilidades. ✨"],
        kingMove:     ["O Rei encontrou seu lugar. Ordem restaurada. 👑🍃", "Liderança com posição. Sábio movimento. 🏛️"],
        stuck:        ["A dificuldade ensina. Observe e encontre. 🧘", "Toda situação tem saída. Respira. 🌿"],
        undo:         ["A sabedoria está em reconhecer e ajustar. 🍃", "Recomeçar é uma forma de sabedoria. ✨"],
        win:          ["Vitória conquistada com paciência e sabedoria. 🏆🌿", "Você jogou com maestria. Merecido. ✨🌟"],
        milestone25:  ["Vinte e cinco passos com propósito. 🌱"],
        milestone50:  ["Cinquenta jogadas de sabedoria. 🌳"],
        longGame:     ["Dez minutos de presença plena. 🍃☕"],
    },
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let _characters  = [];
let _rrIndex     = 0;   // round-robin pointer
let _bubbleTimer = null;

// ── LOAD / SAVE ───────────────────────────────────────────────────────────────
function loadCharacters() {
    try {
        const raw = localStorage.getItem(CHAR_KEY);
        _characters = raw ? JSON.parse(raw) : [];
    } catch(e) { _characters = []; }
}

function saveCharacters(list) {
    _characters = list;
    try { localStorage.setItem(CHAR_KEY, JSON.stringify(list)); } catch(e) {}
}

function getCharacterMode() {
    return localStorage.getItem(CHAR_MODE) || 'random';
}

// ── SELECTION ─────────────────────────────────────────────────────────────────
/**
 * Returns the best character to speak for a given event.
 * Respects activeEvents per character, and the global mode.
 */
function getActiveCharacter(event) {
    if (!_characters || _characters.length === 0) return null;

    // Filter to characters who cover this event (or have no specific filter)
    const eligible = _characters.filter(c =>
        !c.activeEvents || c.activeEvents.length === 0 || c.activeEvents.includes(event)
    );
    if (eligible.length === 0) return null;

    const mode = getCharacterMode();

    if (mode === 'roundrobin') {
        const char = eligible[_rrIndex % eligible.length];
        _rrIndex++;
        return char;
    }

    if (mode.startsWith('single:')) {
        const id = mode.split(':')[1];
        return eligible.find(c => c.id === id) || eligible[0];
    }

    // Default: random
    return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Picks a message for the given event from a character.
 * Falls back to built-in JOKES if no custom messages configured.
 */
function getCharacterMessage(char, event) {
    const custom = char.messages && char.messages[event];
    if (custom && custom.length > 0) {
        const lines = custom.filter(m => m && m.trim());
        if (lines.length > 0) return lines[Math.floor(Math.random() * lines.length)];
    }
    // Use personality preset
    const preset = PERSONALITY_PRESETS[char.personality] || PERSONALITY_PRESETS.funny;
    const presetLines = preset[event];
    if (presetLines && presetLines.length > 0) {
        return presetLines[Math.floor(Math.random() * presetLines.length)];
    }
    return null;
}

// ── BUBBLE RENDERER ───────────────────────────────────────────────────────────
/**
 * Main entry point replacing showJokeBubble().
 * If characters are registered, renders an avatar bubble.
 * Otherwise falls back to the original text-only showJokeBubble().
 *
 * @param {string} event      – JOKES category key
 * @param {string} [fallback] – fallback text from original JOKES (passed from jokes.js)
 * @param {number} [duration] – ms to show bubble
 */
function showCharacterBubble(event, fallback = null, duration = 2800) {
    loadCharacters();
    const char = getActiveCharacter(event);

    if (!char) {
        // No characters — use original joke system
        if (fallback) showJokeBubble(fallback, duration);
        return;
    }

    const msg = getCharacterMessage(char, event);
    if (!msg) {
        if (fallback) showJokeBubble(fallback, duration);
        return;
    }

    _renderAvatarBubble(char, msg, duration);
}

function _renderAvatarBubble(char, text, duration) {
    let bubble = document.getElementById('joke-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'joke-bubble';
        document.body.appendChild(bubble);
    }

    const accentColor = char.color || '#c9a55a';
    const relation = char.relation ? `<span class="char-bubble-relation">${char.relation}</span>` : '';

    if (char.avatar) {
        bubble.innerHTML = `
            <div class="char-bubble-inner" style="--char-color:${accentColor}">
                <img class="char-bubble-avatar" src="${char.avatar}" alt="${char.name}">
                <div class="char-bubble-text">
                    <div class="char-bubble-name">${char.name} ${relation}</div>
                    <div class="char-bubble-msg">${text}</div>
                </div>
            </div>`;
    } else {
        // No photo — show initial letter avatar
        bubble.innerHTML = `
            <div class="char-bubble-inner" style="--char-color:${accentColor}">
                <div class="char-bubble-initial" style="background:${accentColor}">${char.name.charAt(0).toUpperCase()}</div>
                <div class="char-bubble-text">
                    <div class="char-bubble-name">${char.name} ${relation}</div>
                    <div class="char-bubble-msg">${text}</div>
                </div>
            </div>`;
    }

    bubble.classList.remove('hide');
    bubble.classList.add('show', 'char-bubble');

    clearTimeout(_bubbleTimer);
    _bubbleTimer = setTimeout(() => {
        bubble.classList.remove('show');
        bubble.classList.add('hide');
        // Clean up char-bubble class after transition
        setTimeout(() => bubble.classList.remove('char-bubble'), 500);
    }, duration);
}
