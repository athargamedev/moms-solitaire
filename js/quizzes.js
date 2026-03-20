/**
 * quizzes.js -- Family Trivia Quiz Engine (Overhauled)
 * Features: difficulty tiers, categories, timer, cooldown, auto-triggers,
 * streak tracking, and rich rewards via tokens.js.
 */

// Quiz history to avoid repeats in the same session
let _quizHistory = [];
let _triviaTimerInterval = null;
let _triviaTimeLeft = 0;
let _currentQuizDifficulty = 'easy';
let _currentQuizCharId = null;
let _revealedSecrets = JSON.parse(localStorage.getItem('momSolitaire_secrets') || '[]');

// ── QUIZ BANK ─────────────────────────────────────────────────────────────────
// Merges character quizzes + dedicated quiz bank + auto-generated relationship quizzes

function getAllQuizzes() {
    const quizzes = [];

    // 1. Character-based quizzes (from roster)
    const roster = typeof getCharacters === 'function' ? getCharacters() : [];
    roster.forEach(c => {
        if (c.quizzes && c.quizzes.length > 0) {
            c.quizzes.forEach(q => {
                quizzes.push({
                    ...q,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: q.category || 'personal',
                    difficulty: q.difficulty || 'easy',
                });
            });
        }
    });

    // 2. Auto-generate relationship quizzes from roster data
    const chars = roster;
    if (chars.length >= 1) {
        chars.forEach(c => {
            if (c.relation) {
                quizzes.push({
                    question: `Qual e o parentesco de ${c.name} com a Mae?`,
                    answer: c.relation,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: 'relationship',
                    difficulty: 'easy',
                });
            }
            // Photo identification quiz
            if (c.avatar) {
                quizzes.push({
                    question: 'De quem e essa foto?',
                    answer: c.name,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: 'photo',
                    difficulty: 'medium',
                    isPhotoQuiz: true,
                });
            }
            // Hometown quiz
            if (c.hometown) {
                quizzes.push({
                    question: `De onde e ${c.name}?`,
                    answer: c.hometown,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: 'hometown',
                    difficulty: 'medium',
                });
            }
            // Workplace quiz
            if (c.workplace) {
                quizzes.push({
                    question: `Onde ${c.name} trabalha?`,
                    answer: c.workplace,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: 'work',
                    difficulty: 'medium',
                });
            }
            // Education quiz
            if (c.education) {
                quizzes.push({
                    question: `Onde ${c.name} estudou?`,
                    answer: c.education,
                    charId: c.id,
                    charName: c.name,
                    charAvatar: c.avatar,
                    charColor: c.color,
                    charRelation: c.relation,
                    category: 'education',
                    difficulty: 'hard',
                });
            }
        });
    }

    return quizzes;
}

/**
 * Pick a quiz that has not been asked in this session, matching the desired difficulty.
 * Falls back to any difficulty if none match.
 */
function pickQuiz(preferredDifficulty) {
    const all = getAllQuizzes();
    if (all.length === 0) return null;

    // Filter out recently asked questions
    const fresh = all.filter(q => !_quizHistory.includes(q.question));
    const pool = fresh.length > 0 ? fresh : all; // reset if all asked

    // Try preferred difficulty first
    let candidates = pool.filter(q => q.difficulty === preferredDifficulty);
    if (candidates.length === 0) candidates = pool;

    const quiz = candidates[Math.floor(Math.random() * candidates.length)];
    _quizHistory.push(quiz.question);
    // Keep history manageable
    if (_quizHistory.length > 50) _quizHistory = _quizHistory.slice(-30);

    return quiz;
}

// ── GENERATE OPTIONS ──────────────────────────────────────────────────────────

function generateOptions(correctQuiz, numOptions) {
    const opts = [correctQuiz.answer];
    const allQuizzes = getAllQuizzes();

    // Collect potential distractors from same category
    const sameCat = allQuizzes
        .filter(q => q.category === correctQuiz.category && q.answer !== correctQuiz.answer)
        .map(q => q.answer);

    // Also from all quizzes
    const allAnswers = allQuizzes
        .filter(q => q.answer !== correctQuiz.answer)
        .map(q => q.answer);

    const pool = [...new Set([...sameCat, ...allAnswers])];

    // Pull random distractors
    while (opts.length < numOptions && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        if (!opts.includes(pool[idx])) {
            opts.push(pool[idx]);
        }
        pool.splice(idx, 1);
    }

    // If still not enough, generate smart dummies
    if (opts.length < numOptions) {
        if (/^\d{4}$/.test(correctQuiz.answer)) {
            const yr = parseInt(correctQuiz.answer);
            if (!opts.includes((yr - 2).toString())) opts.push((yr - 2).toString());
            if (!opts.includes((yr + 3).toString())) opts.push((yr + 3).toString());
        } else if (/^\d{1,2} de \w+$/i.test(correctQuiz.answer)) {
            if (!opts.includes('12 de marco')) opts.push('12 de marco');
            if (!opts.includes('25 de agosto')) opts.push('25 de agosto');
        } else {
            if (!opts.includes('Nao sei!')) opts.push('Nao sei!');
            if (!opts.includes('Pergunta depois do cafe')) opts.push('Pergunta depois do cafe');
        }
    }

    return opts.slice(0, numOptions).sort(() => Math.random() - 0.5);
}

// ── DIFFICULTY CONFIG ─────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
    easy:   { options: 3, timerSeconds: 20, label: 'Facil',   color: '#6b9b7a' },
    medium: { options: 4, timerSeconds: 15, label: 'Medio',   color: '#c9a55a' },
    hard:   { options: 4, timerSeconds: 12, label: 'Dificil', color: '#b85c5c' },
};

// ── OPEN TRIVIA ───────────────────────────────────────────────────────────────

/**
 * Open the trivia modal for a quiz. Called from the brain button or auto-triggers.
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {boolean} isAutoTrigger - if true, skips cooldown check
 */
function openTriviaForHelp(difficulty, isAutoTrigger) {
    difficulty = difficulty || 'easy';

    // Check cooldown for voluntary quizzes
    if (!isAutoTrigger && typeof canTriggerQuiz === 'function' && !canTriggerQuiz()) {
        const remaining = getQuizCooldownRemaining();
        if (typeof showToast === 'function') showToast(`Quiz cooldown: ${remaining}s remaining`);
        return;
    }

    const quiz = pickQuiz(difficulty);

    if (!quiz) {
        showCharacterBubble('stockSpam', "I don't have any quizzes yet! Have a free move!", 3000);
        if (typeof playNextMove === 'function') playNextMove();
        return;
    }

    _currentQuizDifficulty = quiz.difficulty || difficulty;
    _currentQuizCharId = quiz.charId || null;
    const config = DIFFICULTY_CONFIG[_currentQuizDifficulty] || DIFFICULTY_CONFIG.easy;
    const options = generateOptions(quiz, config.options);

    renderTriviaUI(quiz, options, config);
    startTriviaTimer(config.timerSeconds, quiz.answer);

    if (typeof markQuizTriggered === 'function') markQuizTriggered();

    document.getElementById('triviaOverlay').classList.add('active');
}

function closeTrivia() {
    const overlay = document.getElementById('triviaOverlay');
    overlay.classList.remove('active');
    stopTriviaTimer();
    setTimeout(() => {
        const optsEl = document.getElementById('triviaOptions');
        const fbEl = document.getElementById('triviaFeedback');
        const rwEl = document.getElementById('triviaReward');
        if (optsEl) optsEl.innerHTML = '';
        if (fbEl) fbEl.innerHTML = '';
        if (rwEl) { rwEl.innerHTML = ''; rwEl.style.display = 'none'; }
    }, 300);
}

// ── RENDER TRIVIA UI ──────────────────────────────────────────────────────────

function renderTriviaUI(quiz, options, config) {
    // Character info
    const nameEl = document.getElementById('triviaName');
    nameEl.textContent = quiz.charName + (quiz.charRelation ? ` (${quiz.charRelation})` : '');

    const avatar = document.getElementById('triviaAvatar');
    if (quiz.charAvatar) {
        avatar.style.backgroundImage = `url('${quiz.charAvatar}')`;
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = 'none';
        avatar.style.backgroundColor = quiz.charColor || '#c9a55a';
        avatar.textContent = (quiz.charName || '?').charAt(0).toUpperCase();
    }

    // For photo quizzes, blur the avatar as the challenge
    if (quiz.isPhotoQuiz) {
        avatar.style.filter = 'blur(8px)';
    } else {
        avatar.style.filter = 'none';
    }

    // Difficulty badge
    const diffBadge = document.getElementById('triviaDifficulty');
    if (diffBadge) {
        diffBadge.textContent = config.label;
        diffBadge.style.background = config.color;
        diffBadge.style.color = '#fff';
    }

    // Question
    document.getElementById('triviaQuestion').textContent = quiz.question;

    // Clear feedback and reward
    const feedback = document.getElementById('triviaFeedback');
    feedback.textContent = '';
    feedback.className = 'trivia-feedback';
    const reward = document.getElementById('triviaReward');
    if (reward) { reward.innerHTML = ''; reward.style.display = 'none'; }

    // Options
    const optsWrap = document.getElementById('triviaOptions');
    optsWrap.innerHTML = '';

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost trivia-option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleTriviaAnswer(btn, opt, quiz.answer);
        optsWrap.appendChild(btn);
    });
}

// ── TIMER ─────────────────────────────────────────────────────────────────────

function startTriviaTimer(seconds, correctAnswer) {
    stopTriviaTimer();
    _triviaTimeLeft = seconds;

    const fill = document.getElementById('triviaTimerFill');
    const bar = document.getElementById('triviaTimerBar');
    if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '100%';
        // Force reflow
        fill.offsetHeight;
        fill.style.transition = `width ${seconds}s linear`;
        fill.style.width = '0%';
    }
    if (bar) bar.style.display = 'block';

    _triviaTimerInterval = setInterval(() => {
        _triviaTimeLeft--;
        if (_triviaTimeLeft <= 0) {
            stopTriviaTimer();
            handleTriviaTimeout(correctAnswer);
        }
    }, 1000);
}

function stopTriviaTimer() {
    clearInterval(_triviaTimerInterval);
    _triviaTimerInterval = null;
    const fill = document.getElementById('triviaTimerFill');
    if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
    }
}

function handleTriviaTimeout(correctAnswer) {
    const feedback = document.getElementById('triviaFeedback');
    const btns = document.querySelectorAll('.trivia-option-btn');
    btns.forEach(b => {
        b.disabled = true;
        if (b.textContent === correctAnswer) {
            b.style.background = 'rgba(76, 175, 80, 0.2)';
            b.style.borderColor = 'var(--success, #4CAF50)';
            b.style.color = 'var(--success, #4CAF50)';
        }
    });
    feedback.style.color = 'var(--danger, #F44336)';
    feedback.innerHTML = 'Tempo esgotado! A resposta era: ' + correctAnswer;

    if (typeof recordWrongAnswer === 'function') recordWrongAnswer();

    setTimeout(() => closeTrivia(), 2500);
}

// ── HANDLE ANSWER ─────────────────────────────────────────────────────────────

function handleTriviaAnswer(btn, selected, correct) {
    stopTriviaTimer();
    const feedback = document.getElementById('triviaFeedback');
    const btns = document.querySelectorAll('.trivia-option-btn');

    btns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.style.background = 'var(--success, #4CAF50)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--success, #4CAF50)';
        feedback.style.color = 'var(--success, #4CAF50)';

        // Apply rewards
        const rewards = (typeof applyQuizReward === 'function')
            ? applyQuizReward(_currentQuizDifficulty)
            : { tokens: [], message: 'Correct!' };

        feedback.innerHTML = '🎉 Acertou!';

        // Show reward details
        const rewardEl = document.getElementById('triviaReward');
        if (rewardEl && rewards.message) {
            rewardEl.textContent = rewards.message;
            rewardEl.style.display = 'block';
            rewardEl.className = 'trivia-reward trivia-reward-success';
        }

        if (typeof playSound === 'function') playSound('flip');

        // Check for secret message reveal
        const charWithSecret = _findCharacterSecretMessage(_currentQuizCharId);
        if (charWithSecret) {
            setTimeout(() => {
                closeTrivia();
                _showSecretMessageReveal(charWithSecret);
            }, 2000);
        } else {
            setTimeout(() => {
                closeTrivia();
                if (typeof fullRender === 'function') fullRender();
            }, 2000);
        }
    } else {
        btn.style.background = 'var(--danger, #F44336)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--danger, #F44336)';
        feedback.style.color = 'var(--danger, #F44336)';
        feedback.innerHTML = 'Errou! A resposta era: ' + correct;

        // Paint the correct one
        btns.forEach(b => {
            if (b.textContent === correct) {
                b.style.background = 'rgba(76, 175, 80, 0.2)';
                b.style.borderColor = 'var(--success, #4CAF50)';
                b.style.color = 'var(--success, #4CAF50)';
            }
        });

        if (typeof recordWrongAnswer === 'function') recordWrongAnswer();

        const rewardEl = document.getElementById('triviaReward');
        if (rewardEl) {
            rewardEl.textContent = 'Streak quebrado!';
            rewardEl.style.display = 'block';
            rewardEl.className = 'trivia-reward trivia-reward-fail';
        }

        setTimeout(() => closeTrivia(), 2500);
    }
}

// ── AUTO-TRIGGER QUIZZES ──────────────────────────────────────────────────────

/**
 * Called from the timer loop. Checks if we should pop up an automatic quiz.
 */
function checkAutoQuizTriggers() {
    if (G.won || !G.started) return;

    // Stuck for 30+ seconds -- offer help quiz
    if (typeof isPlayerStuck === 'function' && isPlayerStuck()) {
        // Only trigger once per stuck period
        if (!G._stuckQuizOffered) {
            G._stuckQuizOffered = true;
            showCharacterBubble('stuck', 'Precisa de ajuda? Responda uma pergunta da familia!', 4000);
            setTimeout(() => {
                if (isPlayerStuck()) openTriviaForHelp('easy', true);
            }, 4500);
        }
    } else {
        G._stuckQuizOffered = false;
    }
}

// ── SECRET MESSAGE REVEAL ─────────────────────────────────────────────────────

/**
 * Find if a character has an unrevealed secret message.
 */
function _findCharacterSecretMessage(charId) {
    if (!charId) return null;
    const chars = (typeof getCharacters === 'function') ? getCharacters() : (_characters || []);
    const char = chars.find(c => c.id === charId);
    if (!char || !char.secretMessage) return null;
    // Check if already revealed this session
    if (_revealedSecrets.includes(charId)) return null;
    return char;
}

/**
 * Show a special overlay revealing a family member's secret message.
 */
function _showSecretMessageReveal(char) {
    // Mark as revealed
    _revealedSecrets.push(char.id);
    try { localStorage.setItem('momSolitaire_secrets', JSON.stringify(_revealedSecrets)); } catch(e) {}

    const overlay = document.getElementById('secretMessageOverlay');
    if (!overlay) {
        // Fallback if overlay doesn't exist: show as character bubble
        if (typeof _renderAvatarBubble === 'function') {
            _renderAvatarBubble(char, char.secretMessage, 8000);
        }
        if (typeof fullRender === 'function') fullRender();
        return;
    }

    const avatar = document.getElementById('secretAvatar');
    if (char.avatar) {
        avatar.style.backgroundImage = `url('${char.avatar}')`;
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = 'none';
        avatar.style.backgroundColor = char.color || '#c9a55a';
        avatar.textContent = char.name.charAt(0).toUpperCase();
    }

    document.getElementById('secretName').textContent = `${char.name} (${char.relation || 'Family'})`;
    document.getElementById('secretText').textContent = char.secretMessage;

    overlay.classList.add('active');

    if (typeof playSound === 'function') playSound('win');
}

function closeSecretMessage() {
    const overlay = document.getElementById('secretMessageOverlay');
    if (overlay) overlay.classList.remove('active');
    if (typeof fullRender === 'function') fullRender();
}

/**
 * Called when progress milestones are hit. May trigger a bonus quiz.
 */
function checkMilestoneQuiz() {
    const total = G.foundations.reduce((s, f) => s + f.length, 0);
    const pct = Math.round((total / 52) * 100);

    // Trigger quiz at 25%, 50%, 75%
    const milestones = [25, 50, 75];
    for (const m of milestones) {
        const key = `_milestone${m}Quiz`;
        if (pct >= m && !G[key]) {
            G[key] = true;
            const difficulty = m <= 25 ? 'easy' : m <= 50 ? 'medium' : 'hard';
            setTimeout(() => {
                showCharacterBubble('foundation', `${pct}% completo! Quiz bonus!`, 3000);
                setTimeout(() => openTriviaForHelp(difficulty, true), 3500);
            }, 1000);
            break; // Only one milestone at a time
        }
    }
}
