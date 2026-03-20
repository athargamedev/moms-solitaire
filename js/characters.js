/**
 * characters.js -- Family Character Engine
 * Loads registered family members and shows their photo + message
 * as rich speech bubbles during gameplay.
 * Now includes birthday detection and richer data support.
 *
 * Falls back gracefully to the original JOKES system when no
 * characters are registered.
 */

const CHAR_KEY  = 'momSolitaire_characters';
const CHAR_MODE = 'momSolitaire_charMode';  // 'random' | 'roundrobin' | 'single:id'

// ── PERSONALITY PRESET MESSAGES ──────────────────────────────────────────────
const PERSONALITY_PRESETS = {
    funny: {
        stockSpam:    ["Mae, os cards nao mudam de cor nao!", "Ta pescando? Que puxada!", "O baralho ta ficando zonzo!"],
        foundation:   ["E isso ai! Bora la!", "Olha so que jogada!", "Ta na veia hein!"],
        firstAce:     ["PRIMEIRO AS! A festa comecou!", "Achei um As! Agora vai!"],
        suitComplete: ["NAO ACREDITO! Voce e absurda!", "Naipe completo! Lenda total!"],
        flip:         ["Oi, o que tem ai?", "Que carta surpresa!", "Vamos ver..."],
        kingMove:     ["O Rei chegou! Majestade!", "Rei no trono! Minha rainha!"],
        stuck:        ["Psiu, usa a dica ali o!", "Calma, toda campea fica presa as vezes!"],
        undo:         ["Boa! Segunda chance!", "Voltou! Pensa melhor agora!"],
        win:          ["GANHOU! Eu SABIA! Te amo demais!", "VITORIA! Minha rainha do baralho!"],
        milestone25:  ["25 jogadas! Muito bem!"],
        milestone50:  ["50 jogadas! Dedicacao de campea!"],
        longGame:     ["10 minutinhos! Que paciencia, hein!"],
    },
    sweet: {
        stockSpam:    ["Amor, que tal mover alguma carta primeiro?", "Com calma, voce chega la!"],
        foundation:   ["Perfeito! Que jogada linda!", "Amo ver voce jogar assim!", "Que orgulho!"],
        firstAce:     ["As! Agora sim, meu amor!", "Encontrou! Voce e incrivel!"],
        suitComplete: ["Naipe completo! Que beleza! Te amo!", "Perfeita! Minha estrela!"],
        flip:         ["Curiosidade gostosa!", "O que vira?"],
        kingMove:     ["O Rei do seu coracao!", "Rei no lugar certo! Maravilhosa!"],
        stuck:        ["Vai com calma, voce consegue!", "Cada jogada importa! Vai!"],
        undo:         ["Certinho! Pensa com carinho!", "Otima decisao, querida!"],
        win:          ["GANHOU! Que amor! Te amo tanto!", "Vitoria merecida! Voce brilha!"],
        milestone25:  ["25 jogadas cheias de amor!"],
        milestone50:  ["50 jogadas! Que dedicacao linda!"],
        longGame:     ["10 minutinhos de pura alegria!"],
    },
    coach: {
        stockSpam:    ["FOCO! Analise as opcoes!", "Estrategia! Nao desanima!"],
        foundation:   ["ISSO! BORA!", "Excelente execucao!", "ATAQUE! Continua assim!"],
        firstAce:     ["AS! PARTIU FUNDACAO!", "VAMOS! Base construida!"],
        suitComplete: ["NAIPE INTEIRO! CAMPEA!", "DESTRUINDO O JOGO! Isso e sangue frio!"],
        flip:         ["Mais uma peca! Avanca!", "INFORMACAO! Usa!"],
        kingMove:     ["REI DEPLOYADO! Excelente posicao!", "Abre espaco! Tatica perfeita!"],
        stuck:        ["RESPIRA! Analisa e ataca!", "Dificuldade e treino! Voce aguenta!"],
        undo:         ["RESET TATICO! Recalcula e vai!", "Bom ajuste! Segue em frente!"],
        win:          ["CAMPEA ABSOLUTA! Isso e mentalidade!", "VITORIA! MODO BEAST ATIVADO!"],
        milestone25:  ["25 MOVIMENTOS! RITMO!"],
        milestone50:  ["50 MOVIMENTOS! MAQUINA!"],
        longGame:     ["10 MINUTOS! RESISTENCIA DE FERRO!"],
    },
    wise: {
        stockSpam:    ["As vezes a pausa revela o caminho.", "Observe as colunas antes de agir."],
        foundation:   ["Cada carta no lugar certo. Harmonia.", "Bem jogado, com sabedoria."],
        firstAce:     ["O primeiro passo de uma longa jornada.", "As fundacoes comecam com um As."],
        suitComplete: ["Naipe completo. Equilibrio alcancado.", "Persistencia e sabedoria. Belo resultado."],
        flip:         ["O desconhecido se revela.", "Cada carta contem possibilidades."],
        kingMove:     ["O Rei encontrou seu lugar. Ordem restaurada.", "Lideranca com posicao. Sabio movimento."],
        stuck:        ["A dificuldade ensina. Observe e encontre.", "Toda situacao tem saida. Respira."],
        undo:         ["A sabedoria esta em reconhecer e ajustar.", "Recomecar e uma forma de sabedoria."],
        win:          ["Vitoria conquistada com paciencia e sabedoria.", "Voce jogou com maestria. Merecido."],
        milestone25:  ["Vinte e cinco passos com proposito."],
        milestone50:  ["Cinquenta jogadas de sabedoria."],
        longGame:     ["Dez minutos de presenca plena."],
    },
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let _characters  = [];
let _rrIndex     = 0;   // round-robin pointer
let _bubbleTimer = null;
let _birthdayCharacters = []; // characters whose birthday is today

// ── LOAD / SAVE ───────────────────────────────────────────────────────────────
let _isLoading = false;

async function loadCharacters() {
    if (_isLoading) return;
    _isLoading = true;
    try {
        const response = await fetch('data/roster.json');
        if (response.ok) {
            _characters = await response.json();
            // Normalize messages: convert string messages to arrays for consistency
            _characters.forEach(c => {
                if (c.messages) {
                    Object.keys(c.messages).forEach(key => {
                        if (typeof c.messages[key] === 'string') {
                            c.messages[key] = [c.messages[key]];
                        }
                    });
                }
                // Ensure quizzes array exists
                if (!c.quizzes) c.quizzes = [];
            });
            // Detect birthdays
            detectBirthdays();
        } else {
            _characters = [];
        }
    } catch(e) {
        console.warn('Failed to load roster.json. If running locally without a server, use Live Server or node server.js');
        _characters = [];
    }
    _isLoading = false;
}

// Call on boot
loadCharacters();

function getCharacterMode() {
    return localStorage.getItem(CHAR_MODE) || 'random';
}

function getCharacters() {
    return _characters;
}

// ── BIRTHDAY DETECTION ────────────────────────────────────────────────────────

/**
 * Parse various birthday formats and check if any family member's birthday is today.
 * Supports: "14 de maio", "May 14", "14/05", "1985-05-14", etc.
 */
function detectBirthdays() {
    _birthdayCharacters = [];
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-indexed

    const MONTH_MAP_PT = {
        'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'abril': 3,
        'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
        'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
    };
    const MONTH_MAP_EN = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11,
    };

    _characters.forEach(c => {
        const bday = (c.birthday || '').toLowerCase().trim();
        if (!bday) return;

        let day = null, month = null;

        // Try "DD de MONTH" (Portuguese)
        const ptMatch = bday.match(/^(\d{1,2})\s+de\s+(\w+)/);
        if (ptMatch) {
            day = parseInt(ptMatch[1]);
            month = MONTH_MAP_PT[ptMatch[2]];
        }

        // Try "MONTH DD" (English)
        if (day === null) {
            const enMatch = bday.match(/^(\w+)\s+(\d{1,2})/);
            if (enMatch) {
                day = parseInt(enMatch[2]);
                month = MONTH_MAP_EN[enMatch[1]];
            }
        }

        // Try "DD/MM" or "DD-MM"
        if (day === null) {
            const numMatch = bday.match(/^(\d{1,2})[\/\-](\d{1,2})/);
            if (numMatch) {
                day = parseInt(numMatch[1]);
                month = parseInt(numMatch[2]) - 1; // Convert to 0-indexed
            }
        }

        if (day === todayDay && month === todayMonth) {
            _birthdayCharacters.push(c);
        }
    });
}

function getBirthdayCharacters() {
    return _birthdayCharacters;
}

function isBirthdayToday() {
    return _birthdayCharacters.length > 0;
}

/**
 * Show a birthday celebration overlay for the first birthday character found.
 */
function showBirthdayGreeting() {
    if (_birthdayCharacters.length === 0) return;

    const char = _birthdayCharacters[0];
    const overlay = document.getElementById('birthdayOverlay');
    if (!overlay) return;

    const avatar = document.getElementById('birthdayAvatar');
    if (char.avatar) {
        avatar.style.backgroundImage = `url('${char.avatar}')`;
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = 'none';
        avatar.style.backgroundColor = char.color || '#c9a55a';
        avatar.textContent = char.name.charAt(0).toUpperCase();
    }

    document.getElementById('birthdayName').textContent = `Feliz Aniversario, ${char.name}!`;
    const customGreeting = char.birthdayGreeting;
    document.getElementById('birthdayMessage').textContent = customGreeting
        ? customGreeting
        : `Hoje e o aniversario de ${char.name} (${char.relation || 'Familia'})! ` +
          `Vamos jogar em homenagem a essa pessoa especial!`;

    overlay.classList.add('active');
}

function closeBirthday() {
    const overlay = document.getElementById('birthdayOverlay');
    if (overlay) overlay.classList.remove('active');
}

// ── SELECTION ─────────────────────────────────────────────────────────────────
/**
 * Returns the best character to speak for a given event.
 * Birthday characters get priority.
 */
function getActiveCharacter(event) {
    if (!_characters || _characters.length === 0) return null;

    // Birthday characters get priority
    if (_birthdayCharacters.length > 0) {
        const bdayEligible = _birthdayCharacters.filter(c =>
            !c.activeEvents || c.activeEvents.length === 0 || c.activeEvents.includes(event)
        );
        if (bdayEligible.length > 0) {
            return bdayEligible[Math.floor(Math.random() * bdayEligible.length)];
        }
    }

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

    return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Picks a message for the given event from a character.
 */
function getCharacterMessage(char, event) {
    const custom = char.messages && char.messages[event];
    if (custom) {
        // Support both string and array formats
        const lines = Array.isArray(custom)
            ? custom.filter(m => m && m.trim())
            : (typeof custom === 'string' && custom.trim()) ? [custom] : [];
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
 */
function showCharacterBubble(event, fallback, duration) {
    duration = duration || 2800;
    const char = getActiveCharacter(event);

    if (!char) {
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
    const bdayBadge = _birthdayCharacters.some(b => b.id === char.id)
        ? '<span class="char-birthday-badge">🎂</span>' : '';

    if (char.avatar) {
        bubble.innerHTML = `
            <div class="char-bubble-inner" style="--char-color:${accentColor}">
                <img class="char-bubble-avatar" src="${char.avatar}" alt="${char.name}">
                <div class="char-bubble-text">
                    <div class="char-bubble-name">${char.name} ${relation} ${bdayBadge}</div>
                    <div class="char-bubble-msg">${text}</div>
                </div>
            </div>`;
    } else {
        bubble.innerHTML = `
            <div class="char-bubble-inner" style="--char-color:${accentColor}">
                <div class="char-bubble-initial" style="background:${accentColor}">${char.name.charAt(0).toUpperCase()}</div>
                <div class="char-bubble-text">
                    <div class="char-bubble-name">${char.name} ${relation} ${bdayBadge}</div>
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
        setTimeout(() => bubble.classList.remove('char-bubble'), 500);
    }, duration);
}
