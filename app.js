(function(){
	'use strict';

	const dom = id => document.getElementById(id);
	const screenStart = dom('screen-start');
	const screenQuiz = dom('screen-quiz');
	const screenResults = dom('screen-results');
	const screenReview = dom('screen-review');

	const startForm = dom('startForm');
	const qIndexEl = dom('qIndex');
	const qTotalEl = dom('qTotal');
	const questionText = dom('questionText');
	const answersForm = dom('answers');
	const submitBtn = dom('submitAnswer');
	const nextBtn = dom('nextQuestion');
	const feedback = dom('feedback');
	const timerBar = dom('timerBar');
	const timerText = dom('timerText');
	const scoreNumber = dom('scoreNumber');
	const scoreFill = dom('scoreFill');
	const breakdownEl = dom('breakdown');
	const reviewList = dom('reviewList');
	const reviewAnswersBtn = dom('reviewAnswers');
	const playAgainBtn = dom('playAgain');
	const backToResultsBtn = dom('backToResults');
	const themeToggle = dom('themeToggle');
	const resetAppBtn = dom('resetApp');
	const badgesWrap = dom('badges');
	const hintBtn = dom('hintBtn');
	const skipBtn = dom('skipBtn');
	const pauseBtn = dom('pauseBtn');
	const leaderboardList = document.getElementById('leaderboardList');

	const STORAGE_KEY = 'edunet_quiz_state_v2';
	const THEME_KEY = 'edunet_theme';

	let state = {
		questionSet: [],
		currentIndex: 0,
		selectedOption: null,
		answers: [],
		score: 0,
		timePerQuestion: 20,
		timerRemaining: 20,
		timerId: null,
		source: 'api',
		categoryAccuracy: {},
		meta: { difficulty: 'any', category: 'any', playerName: '' },
		paused: false
	};

	function saveState(){
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}
	function loadState(){
		try{
			const raw = localStorage.getItem(STORAGE_KEY);
			if(!raw) return null;
			return JSON.parse(raw);
		}catch{ return null; }
	}
	function clearState(){
		localStorage.removeItem(STORAGE_KEY);
	}

	function setTheme(theme){
		if(theme !== 'light' && theme !== 'dark'){ return; }
		document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
		localStorage.setItem(THEME_KEY, theme);
		themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'false' : 'true');
	}
	function toggleTheme(){
		const current = localStorage.getItem(THEME_KEY) || 'dark';
		setTheme(current === 'dark' ? 'light' : 'dark');
	}

	function showScreen(id){
		[screenStart, screenQuiz, screenResults, screenReview].forEach(s=>s.classList.remove('active'));
		document.getElementById(id).classList.add('active');
	}

	function decodeHtml(html){
		const txt = document.createElement('textarea');
		txt.innerHTML = html;
		return txt.value;
	}

	function shuffle(array){
		for(let i=array.length-1;i>0;i--){
			const j = Math.floor(Math.random()*(i+1));
			[array[i],array[j]] = [array[j],array[i]];
		}
		return array;
	}

	// ---- Aptitude question generators with solutions ----
	// Each generator returns: { category, question, correct, options, solution }
	function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
	function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

	function genTimeWork(){
		// Example: A alone can do a work in a days, B alone in b days. Together?
		const a = randInt(6, 18);
		const b = randInt(8, 24);
		const together = +( (a*b)/(a+b) ).toFixed(2);
		const opts = [together, +(together*2).toFixed(2), +(together*0.5).toFixed(2), +(together+randInt(1,4)).toFixed(2)];
		const unique = [...new Set(opts)].slice(0,4);
		while(unique.length<4){ unique.push(+(together+Math.random()*3).toFixed(2)); }
		return {
			category: 'Time & Work',
			question: `A alone can finish a work in ${a} days and B alone in ${b} days. In how many days can they finish the work together?`,
			correct: `${together} days`,
			options: shuffle(unique.map(v=>`${v} days`)),
			solution: `Rates: A = 1/${a}, B = 1/${b} work/day. Together = 1/${a} + 1/${b} = ${(a+b)}/${a*b}. Time = 1 / ( ${(a+b)}/${a*b} ) = ${(a*b)}/${(a+b)} = ${together} days.`
		};
	}

	function genSpeedDistance(){
		// Example: distance = speed * time, find time
		const speed = randInt(30, 80); // km/h
		const distance = randInt(90, 320); // km
		const time = +(distance/speed).toFixed(2);
		const opts = [time, +(time+0.5).toFixed(2), +(time-0.5).toFixed(2), +(time*1.5).toFixed(2)];
		return {
			category: 'Speed & Distance',
			question: `A car travels ${distance} km at ${speed} km/h. How many hours does it take?`,
			correct: `${time} hours`,
			options: shuffle([...new Set(opts)].map(v=>`${v} hours`)),
			solution: `Use t = d / s. t = ${distance} / ${speed} = ${time} hours.`
		};
	}

	function genProfitLoss(){
		const cp = randInt(80, 900);
		const profitPct = randChoice([10,12,15,20,25,30]);
		const sp = +(cp * (1 + profitPct/100)).toFixed(2);
		const opts = [sp, +(sp+randInt(5,40)).toFixed(2), +(sp-randInt(5,40)).toFixed(2), +(sp*1.1).toFixed(2)];
		return {
			category: 'Profit & Loss',
			question: `An item costs ₹${cp}. If it is sold at a profit of ${profitPct}%, find the selling price.`,
			correct: `₹${sp}`,
			options: shuffle([...new Set(opts)].map(v=>`₹${v}`)),
			solution: `SP = CP × (1 + profit/100) = ${cp} × (1 + ${profitPct}/100) = ₹${sp}.`
		};
	}

	function genCalendar(){
		// Day of week offset question
		const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
		const start = randChoice(days);
		const offset = randInt(1, 200);
		const startIdx = days.indexOf(start);
		const endIdx = (startIdx + offset) % 7;
		const ans = days[endIdx];
		const opts = shuffle([ans, randChoice(days), randChoice(days), randChoice(days)]);
		return {
			category: 'Calendar',
			question: `If today is ${start}, what day will it be after ${offset} days?`,
			correct: ans,
			options: [...new Set(opts)],
			solution: `Each 7 days the weekday repeats. ${offset} mod 7 = ${offset%7}. ${start} + ${offset%7} ⇒ ${ans}.`
		};
	}

	function genSimpleInterest(){
		const p = randInt(500, 5000);
		const r = randInt(3, 15);
		const t = randInt(1, 5);
		const si = +((p*r*t)/100).toFixed(2);
		const opts = [si, +(si+randInt(20,80)).toFixed(2), +(si-randInt(10,40)).toFixed(2), +(si*1.25).toFixed(2)];
		return {
			category: 'Simple Interest',
			question: `Find the simple interest on ₹${p} at ${r}% per annum for ${t} years.`,
			correct: `₹${si}`,
			options: shuffle([...new Set(opts)].map(v=>`₹${v}`)),
			solution: `SI = (P×R×T)/100 = (${p}×${r}×${t})/100 = ₹${si}.`
		};
	}

	function genCompoundInterest(){
		const p = randInt(500, 5000);
		const r = randInt(3, 12);
		const t = randInt(1, 3);
		const amount = +(p * Math.pow(1 + r/100, t)).toFixed(2);
		const ci = +(amount - p).toFixed(2);
		const opts = [ci, +(ci+randInt(20,100)).toFixed(2), +(ci*1.3).toFixed(2), +(ci-randInt(10,40)).toFixed(2)];
		return {
			category: 'Compound Interest',
			question: `What is the compound interest on ₹${p} at ${r}% per annum for ${t} years?`,
			correct: `₹${ci}`,
			options: shuffle([...new Set(opts)].map(v=>`₹${v}`)),
			solution: `A = P(1 + r/100)^t = ${p}(1 + ${r}/100)^${t} = ₹${amount}. CI = A − P = ₹${ci}.`
		};
	}

	const generators = {
		any: [genTimeWork, genSpeedDistance, genProfitLoss, genCalendar, genSimpleInterest, genCompoundInterest],
		time_work: [genTimeWork],
		speed_distance: [genSpeedDistance],
		profit_loss: [genProfitLoss],
		calendar: [genCalendar],
		simple_interest: [genSimpleInterest],
		compound_interest: [genCompoundInterest]
	};

	function generateAptitudeQuestions(amount, categoryKey){
		const gens = categoryKey && generators[categoryKey] ? generators[categoryKey] : generators.any;
		// Build a larger bank then sample without replacement to mimic real tests
		const seen = new Set();
		const bank = [];
		const targetBankSize = Math.max(amount * 4, 40);
		while(bank.length < targetBankSize){
			const g = randChoice(gens);
			const q = g();
			const signature = `${q.category}|${q.question}`;
			if(seen.has(signature)) continue;
			seen.add(signature);
			bank.push(q);
		}
		shuffle(bank);
		return bank.slice(0, amount).map(q=>({
			category: q.category,
			difficulty: 'any',
			question: q.question,
			correct_answer: q.correct,
			incorrect_answers: q.options.filter(o=>o!==q.correct),
			solution: q.solution
		}));
	}

	async function fetchQuestions(opts){
		// Try local JSON bank first
		try{
			const res = await fetch('questions.json', { cache:'no-store' });
			if(res.ok){
				const data = await res.json();
				const bank = (data && Array.isArray(data.questions)) ? data.questions : [];
				// Filter by category if provided
				const filtered = (opts.category && opts.category !== 'any')
					? bank.filter(q=>{
						const key = opts.category;
						const map = {
							time_work: 'Time & Work',
							speed_distance: 'Speed & Distance',
							profit_loss: 'Profit & Loss',
							calendar: 'Calendar',
							simple_interest: 'Simple Interest',
							compound_interest: 'Compound Interest'
						};
						return q.category === map[key];
					})
					: bank;
				shuffle(filtered);
				const need = opts.amount || 10;
				let chosen = filtered.slice(0, need);
				if(chosen.length < need){
					// Backfill from generators to reach desired count
					const backfill = generateAptitudeQuestions(need - chosen.length, opts.category);
					// Convert backfill to same shape as bank entries
					const backfillBank = backfill.map(q=>({
						category: q.category,
						question: q.question,
						correct_answer: q.correct_answer || q.correct,
						incorrect_answers: q.incorrect_answers,
						solution: q.solution
					}));
					chosen = chosen.concat(backfillBank);
				}
				if(chosen.length){ return { source:'json+generated', items: chosen }; }
			}
		}catch(e){
			console.warn('questions.json not available or invalid', e);
		}
		// Fallback to generated
		const items = generateAptitudeQuestions(opts.amount || 10, opts.category);
		return { source:'generated', items };
	}

	function prepareQuestions(rawItems){
		return rawItems.map((q,i)=>{
			const allOptions = shuffle([q.correct_answer, ...q.incorrect_answers].map(decodeHtml));
			return {
				id: i+1,
				category: decodeHtml(q.category || 'Aptitude'),
				difficulty: q.difficulty || 'any',
				question: decodeHtml(q.question),
				correct: decodeHtml(q.correct_answer),
				options: allOptions,
				solution: q.solution || ''
			};
		});
	}

	function renderQuestion(){
		const q = state.questionSet[state.currentIndex];
		qIndexEl.textContent = String(state.currentIndex+1);
		qTotalEl.textContent = String(state.questionSet.length);
		questionText.textContent = q.question;
		answersForm.innerHTML = '';
		answersForm.setAttribute('aria-labelledby','quizHeading');

		q.options.forEach((opt, idx)=>{
			const id = `opt_${state.currentIndex}_${idx}`;
			const label = document.createElement('label');
			label.className = 'answer';
			label.setAttribute('role','radio');
			label.setAttribute('aria-checked','false');
			label.setAttribute('tabindex','0');
			label.htmlFor = id;

			const input = document.createElement('input');
			input.type = 'radio';
			input.name = 'answer';
			input.id = id;
			input.value = opt;

			label.appendChild(input);
			label.appendChild(document.createTextNode(opt));

			label.addEventListener('click', ()=>selectOption(opt, label));
			label.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); selectOption(opt, label); }});

			answersForm.appendChild(label);
		});

		feedback.textContent = '';
		submitBtn.disabled = true;
		nextBtn.disabled = true;
		if(hintBtn) hintBtn.disabled = false;
		if(skipBtn) skipBtn.disabled = false;
		if(pauseBtn) { pauseBtn.disabled = false; pauseBtn.textContent = 'Pause'; }

		state.selectedOption = null;
		startTimer();
		questionText.focus();
	}

	function selectOption(opt, labelEl){
		state.selectedOption = opt;
		[...answersForm.children].forEach(l=>{l.classList.remove('selected'); l.setAttribute('aria-checked','false');});
		labelEl.classList.add('selected');
		labelEl.setAttribute('aria-checked','true');
		submitBtn.disabled = false;
	}

	function startTimer(){
		stopTimer();
		state.timerRemaining = state.timePerQuestion;
		timerText.textContent = String(state.timerRemaining);
		updateTimerBar();
		state.timerId = setInterval(()=>{
			if(state.paused){ return; }
			state.timerRemaining -= 1;
			if(state.timerRemaining <= 0){
				timerText.textContent = '0';
				updateTimerBar();
				stopTimer();
				autoSubmit();
			} else {
				timerText.textContent = String(state.timerRemaining);
				updateTimerBar();
			}
		}, 1000);
	}
	function stopTimer(){
		if(state.timerId){ clearInterval(state.timerId); state.timerId=null; }
	}
	function updateTimerBar(){
		const p = Math.max(0, Math.min(1, state.timerRemaining / state.timePerQuestion));
		timerBar.style.setProperty('--p', String(p));
	}

	function submitAnswer(){
		if(nextBtn.disabled === false) return; // prevent double scoring
		stopTimer();
		const q = state.questionSet[state.currentIndex];
		const selected = state.selectedOption;
		const isCorrect = selected === q.correct;
		// Record answer even on auto-submit
		state.answers[state.currentIndex] = { selected: selected ?? null };
		if(isCorrect) state.score += 1;

		// Track category accuracy
		const key = q.category;
		state.categoryAccuracy[key] = state.categoryAccuracy[key] || { correct:0, total:0 };
		state.categoryAccuracy[key].total += 1;
		if(isCorrect) state.categoryAccuracy[key].correct += 1;

		// Visual feedback
		[...answersForm.children].forEach(l=>{
			const val = l.querySelector('input').value;
			l.classList.toggle('correct', val === q.correct);
			if(selected && val === selected && !isCorrect){ l.classList.add('incorrect'); }
			l.setAttribute('aria-disabled','true');
		});
		feedback.textContent = isCorrect ? 'Correct!' : `Incorrect. Correct answer: ${q.correct}`;

		nextBtn.disabled = false;
		submitBtn.disabled = true;
		if(hintBtn) hintBtn.disabled = true;
		if(skipBtn) skipBtn.disabled = true;
		if(pauseBtn) pauseBtn.disabled = true;
		saveState();
	}

	function autoSubmit(){
		submitAnswer();
	}

	function goNext(){
		if(state.currentIndex + 1 >= state.questionSet.length){
			finishQuiz();
			return;
		}
		state.currentIndex += 1;
		renderQuestion();
		saveState();
	}

	function finishQuiz(){
		showScreen('screen-results');
		const total = state.questionSet.length;
		scoreNumber.textContent = `${state.score}/${total}`;
		const pct = total ? Math.round((state.score/total)*100) : 0;
		scoreFill.style.width = pct + '%';
		breakdownEl.innerHTML = renderBreakdownHtml();
		renderBadges(pct);
		updateLeaderboard({ name: state.meta.playerName || 'Anonymous', score: state.score, total, pct, when: Date.now() });
		saveState();
	}

	function renderBreakdownHtml(){
		const rows = Object.entries(state.categoryAccuracy).map(([cat, v])=>{
			const pct = v.total ? Math.round((v.correct/v.total)*100) : 0;
			return `<div class="row"><strong>${cat}</strong>: ${v.correct}/${v.total} (${pct}%)</div>`;
		});
		return rows.join('') || '<div>No category stats.</div>';
	}

	function renderBadges(pct){
		badgesWrap.innerHTML = '';
		const earned = [];
		if(pct >= 90) earned.push({ label:'🏆 Ace', title:'Scored 90%+ in a quiz' });
		if(state.score >= 5) earned.push({ label:'⭐ Streak', title:'5+ correct answers' });
		if(state.source === 'offline') earned.push({ label:'🛰️ Resilient', title:'Played in offline mode' });
		if(Object.keys(state.categoryAccuracy).length >= 3) earned.push({ label:'🧠 Explorer', title:'Answered across 3+ categories' });
		for(const b of earned){
			const el = document.createElement('span');
			el.className = 'badge';
			el.title = b.title;
			el.textContent = b.label;
			badgesWrap.appendChild(el);
		}
	}

	function showReview(){
		reviewList.innerHTML = '';
		state.questionSet.forEach((q, idx)=>{
			const li = document.createElement('li');
			const userAns = state.answers[idx]?.selected ?? null;
			const isCorrect = userAns === q.correct;
			li.innerHTML = `<div><strong>Q${idx+1}:</strong> ${q.question}</div>
			<div><strong>Your:</strong> ${userAns||'-'} | <strong>Correct:</strong> ${q.correct}</div>
			<div>${isCorrect ? '✅' : '❌'}</div>
			<div><em>Method:</em> ${q.solution ? q.solution : '—'}</div>`;
			reviewList.appendChild(li);
		});
		showScreen('screen-review');
	}

	function startQuizFromForm(e){
		e.preventDefault();
		const formData = new FormData(startForm);
		const amount = Math.max(5, Math.min(20, Number(formData.get('amount')||10)));
		const category = String(formData.get('category')||'any');
		const difficulty = String(formData.get('difficulty')||'any');
		const timePer = Math.max(5, Math.min(90, Number(formData.get('timePer')||20)));
		const playerName = String(formData.get('playerName')||'');

		state = { ...state, currentIndex:0, selectedOption:null, answers:[], score:0, categoryAccuracy:{}, timePerQuestion: timePer, meta:{ difficulty, category, playerName }, paused:false };

		loadQuestions({ amount, category, difficulty });
	}

	async function loadQuestions(opts){
		submitBtn.disabled = true; nextBtn.disabled = true; feedback.textContent = '';
		const { source, items } = await fetchQuestions(opts);
		state.source = source;
		state.questionSet = prepareQuestions(items);
		state.currentIndex = 0; state.answers = []; state.score = 0; state.categoryAccuracy = {};
		showScreen('screen-quiz');
		renderQuestion();
		saveState();
	}

	// Hint, skip, pause logic
	hintBtn?.addEventListener('click', async ()=>{
		const q = state.questionSet[state.currentIndex];
		let hint = q.solution ? q.solution : '';
		if(!hint){
			const answer = q.correct;
			hint = 'Think: starts with "' + answer[0] + '"';
		}
		feedback.textContent = 'Hint: ' + hint;
	});

	skipBtn?.addEventListener('click', ()=>{
		stopTimer();
		state.answers[state.currentIndex] = { selected: null };
		submitAnswer();
	});

	pauseBtn?.addEventListener('click', ()=>{
		state.paused = !state.paused;
		pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
	});

	function updateLeaderboard(entry){
		const key = 'edunet_leaderboard_v1';
		let list = [];
		try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch{}
		list.push(entry);
		list.sort((a,b)=> b.pct - a.pct);
		list = list.slice(0,10);
		localStorage.setItem(key, JSON.stringify(list));
		renderLeaderboard(list);
	}

	function renderLeaderboard(list){
		if(!leaderboardList) return;
		leaderboardList.innerHTML = '';
		(list||[]).forEach((e,i)=>{
			const li = document.createElement('li');
			li.textContent = `${i+1}. ${e.name} - ${e.score}/${e.total} (${e.pct}%)`;
			leaderboardList.appendChild(li);
		});
	}

	// Firestore stubs (non-blocking)
	async function saveScoreToFirestore(scoreDoc){
		// TODO: integrate Firebase SDK; this is a stub
		console.log('Firestore stub save:', scoreDoc);
	}

	// AI stubs (non-blocking)
	async function getHintForQuestion(question){
		// Integrate with GPT API if available. Return a fake hint for now.
		return `Think about key terms in the question: "${question.slice(0,50)}..."`;
	}

	// Keyboard shortcuts
	window.addEventListener('keydown', e=>{
		if(screenQuiz.classList.contains('active')){
			if(e.key === 'Enter' && !submitBtn.disabled){ submitAnswer(); }
			if(e.key === 'ArrowRight' && !nextBtn.disabled){ goNext(); }
		}
	});

	// Wire controls
	startForm.addEventListener('submit', startQuizFromForm);
	submitBtn.addEventListener('click', ()=>{
		if(state.selectedOption){
			state.answers[state.currentIndex] = { selected: state.selectedOption };
		}
		submitAnswer();
	});
	nextBtn.addEventListener('click', goNext);
	reviewAnswersBtn.addEventListener('click', showReview);
	playAgainBtn.addEventListener('click', ()=>{ showScreen('screen-start'); });
	backToResultsBtn.addEventListener('click', ()=>{ showScreen('screen-results'); });
	themeToggle.addEventListener('click', toggleTheme);
	resetAppBtn.addEventListener('click', ()=>{ clearState(); location.reload(); });

	// Restore session
	(function init(){
		const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
		setTheme(savedTheme);
		const saved = loadState();
		if(saved && saved.questionSet?.length){
			state = { ...state, ...saved };
			if(saved.timerRemaining && saved.currentIndex < saved.questionSet.length){
				showScreen('screen-quiz');
				renderQuestion();
			} else {
				showScreen('screen-results');
				scoreNumber.textContent = `${state.score}/${state.questionSet.length}`;
				scoreFill.style.width = `${Math.round((state.score/state.questionSet.length)*100)}%`;
				breakdownEl.innerHTML = renderBreakdownHtml();
				renderBadges(Math.round((state.score/state.questionSet.length)*100));
			}
		} else {
			showScreen('screen-start');
		}

		try{ renderLeaderboard(JSON.parse(localStorage.getItem('edunet_leaderboard_v1')||'[]')); }catch{}
	})();
})();
