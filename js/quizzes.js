/**
 * quizzes.js – Family Trivia Quiz Engine
 * Integrates directly with characters.js to grab quizzes
 * and grant rewards (like auto-playing a move) if answered correctly.
 */

function openTriviaForHelp() {
    // Collect all characters with at least one quiz
    const charsWithQuizzes = (_characters || []).filter(c => c.quizzes && c.quizzes.length > 0);

    if (charsWithQuizzes.length === 0) {
        // No quizzes available in the DB, just fall back to normal behavior
        showCharacterBubble('stockSpam', "I don't have any quizzes yet! Have a free move! 🎁", 3000);
        playNextMove(); // defined in autoplay.js
        return;
    }

    // Pick a random char and random quiz
    const char = charsWithQuizzes[Math.floor(Math.random() * charsWithQuizzes.length)];
    const quiz = char.quizzes[Math.floor(Math.random() * char.quizzes.length)];

    // Generate multiple choice options (1 correct, 2 distractors)
    const options = generateOptions(quiz, charsWithQuizzes);

    renderTriviaUI(char, quiz, options);
    document.getElementById('triviaOverlay').classList.add('show');
}

function closeTrivia() {
    const overlay = document.getElementById('triviaOverlay');
    overlay.classList.remove('show');
    // small delay for css transition
    setTimeout(() => {
        document.getElementById('triviaOptions').innerHTML = '';
        document.getElementById('triviaFeedback').innerHTML = '';
    }, 300);
}

function generateOptions(correctQuiz, allChars) {
    const opts = [correctQuiz.answer];
    
    // Attempt to find similar answers from other quizzes
    const allAnswers = [];
    allChars.forEach(c => c.quizzes.forEach(q => {
        if (q.answer !== correctQuiz.answer) allAnswers.push(q.answer);
    }));
    
    // Deduplicate
    const pool = [...new Set(allAnswers)];
    
    // Pull random distractors
    while(opts.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        opts.push(pool[idx]);
        pool.splice(idx, 1);
    }

    // If still not enough, generate smart dummies
    if (opts.length < 3) {
        if (/^\d{4}$/.test(correctQuiz.answer)) {
            const yr = parseInt(correctQuiz.answer);
            if (!opts.includes((yr - 2).toString())) opts.push((yr - 2).toString());
            if (!opts.includes((yr + 3).toString())) opts.push((yr + 3).toString());
        } else if (/^\d{1,2} de \w+$/.test(correctQuiz.answer.toLowerCase())) { // e.g. "14 de maio"
            opts.push("12 de março");
            opts.push("25 de agosto");
        } else {
            opts.push("I have absolutely no idea!");
            opts.push("Ask me after coffee ☕");
        }
    }

    // Shuffle array
    return opts.sort(() => Math.random() - 0.5);
}

function renderTriviaUI(char, quiz, options) {
    document.getElementById('triviaName').textContent = char.name + (char.relation ? ` (${char.relation})` : '');
    
    const avatar = document.getElementById('triviaAvatar');
    if (char.avatar) {
        avatar.style.backgroundImage = `url('${char.avatar}')`;
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = 'none';
        avatar.style.backgroundColor = char.color || '#c9a55a';
        avatar.textContent = char.name.charAt(0).toUpperCase();
    }

    document.getElementById('triviaQuestion').textContent = quiz.question;
    const feedback = document.getElementById('triviaFeedback');
    feedback.textContent = '';
    feedback.className = 'trivia-feedback';

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

function handleTriviaAnswer(btn, selected, correct) {
    const feedback = document.getElementById('triviaFeedback');
    const btns = document.querySelectorAll('.trivia-option-btn');
    
    // Disable all so they can't spam clicks
    btns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.style.background = 'var(--success, #4CAF50)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--success, #4CAF50)';
        feedback.style.color = 'var(--success, #4CAF50)';
        feedback.innerHTML = '🎉 Acertou! You earned a free move!';
        if (typeof playSound === 'function') playSound('flip'); // Or custom success
        
        setTimeout(() => {
            closeTrivia();
            playNextMove(); // Grant reward: the game plays the best move for her!
        }, 1800);
    } else {
        btn.style.background = 'var(--danger, #F44336)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--danger, #F44336)';
        feedback.style.color = 'var(--danger, #F44336)';
        feedback.innerHTML = '❌ Oops! Errou. Try again later!';
        
        // Paint the correct one green to teach her
        btns.forEach(b => {
            if (b.textContent === correct) {
                b.style.background = 'rgba(76, 175, 80, 0.2)';
                b.style.borderColor = 'var(--success, #4CAF50)';
                b.style.color = 'var(--success, #4CAF50)';
            }
        });

        setTimeout(() => {
            closeTrivia();
        }, 2500);
    }
}
