<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { ALL_DECKS } from '$lib/data/decks.js';
	import { shuffle } from '$lib/utils/shuffle.js';
	import {
		initSrsCard,
		scheduleResult,
		mergeExistingStats,
		stats,
		makeId
	} from '$lib/utils/srs.js';
	import { playCardAudio, ensureVoicesLoaded } from '$lib/utils/audio.js';

	const STORAGE_KEY = 'hiraganaSettings:v3'; // SRS state
	const REVIEW_LOG_KEY = 'hiraganaReviewLog:v1'; // append-only review events

	let selectedDeckIds = new Set(['basic']);
	let mode = 'flashcard';
	let direction = 'kanaToRomaji';
	let dueOnly = true;

	let cards = [];
	let queue = [];
	let index = 0;
	let showAnswer = false;
	let correctCount = 0;
	let incorrectCount = 0;

	$: current = cards.find((c) => c.id === queue[index]);
	$: progress = queue.length ? `${index + 1} / ${queue.length}` : '0 / 0';
	$: summary = stats(cards);

	function persist() {
		if (!browser) return;
		const payload = {
			selectedDeckIds: [...selectedDeckIds],
			mode,
			direction,
			dueOnly,
			index,
			correctCount,
			incorrectCount,
			cards
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	}

	function appendReviewLog({ id, kana, romaji, ok }) {
		if (!browser) return;
		const entry = { t: Date.now(), id, kana, romaji, ok: !!ok };
		const raw = localStorage.getItem(REVIEW_LOG_KEY);
		let arr = [];
		try {
			arr = raw ? JSON.parse(raw) : [];
		} catch {
			arr = [];
		}
		arr.push(entry);
		// keep it bounded (e.g., last 10k events)
		if (arr.length > 10000) arr = arr.slice(arr.length - 10000);
		localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(arr));
	}

	function selectedDeckArray() {
		return [...selectedDeckIds].map((id) => ALL_DECKS[id].cards);
	}

	function rebuildQueue() {
		const now = Date.now();
		const dueIds = cards.filter((c) => c.due <= now).map((c) => c.id);
		const futureIds = cards
			.filter((c) => c.due > now)
			.sort((a, b) => a.due - b.due)
			.map((c) => c.id);
		queue = dueOnly ? shuffle(dueIds) : shuffle([...dueIds, ...futureIds]);
		if (queue.length === 0 && dueOnly && futureIds.length) {
			queue = futureIds.slice(0, Math.min(10, futureIds.length));
		}
		index = 0;
		showAnswer = false;
	}

	function restoreOrInit() {
		const allRaw = selectedDeckArray().flat();
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
			if (saved && Array.isArray(saved.cards)) {
				selectedDeckIds = new Set(saved.selectedDeckIds || ['basic']);
				mode = saved.mode || 'flashcard';
				direction = saved.direction || 'kanaToRomaji';
				dueOnly = typeof saved.dueOnly === 'boolean' ? saved.dueOnly : true;

				const existingById = Object.fromEntries(
					(saved.cards || []).map((c) => [c.id || makeId(c), c])
				);
				cards = mergeExistingStats(allRaw, existingById);

				rebuildQueue();
				index = Math.min(saved.index ?? 0, Math.max(queue.length - 1, 0));
				correctCount = saved.correctCount ?? 0;
				incorrectCount = saved.incorrectCount ?? 0;
			} else {
				cards = mergeExistingStats(allRaw, {});
				rebuildQueue();
				persist();
			}
		} catch {
			cards = mergeExistingStats(allRaw, {});
			rebuildQueue();
			persist();
		}
	}

	onMount(async () => {
		// onMount never runs on server, but we keep the guard for safety
		if (browser) {
			await ensureVoicesLoaded();
			restoreOrInit();
			window.addEventListener('keydown', handleKeys);
		}
	});

	onDestroy(() => {
		if (browser) window.removeEventListener('keydown', handleKeys);
	});

	function applyDeckSelection() {
		const allRaw = selectedDeckArray().flat();
		const existingById = Object.fromEntries(cards.map((c) => [c.id, c]));
		cards = mergeExistingStats(allRaw, existingById);
		correctCount = 0;
		incorrectCount = 0;
		rebuildQueue();
		persist();
	}

	function flip() {
		if (mode === 'flashcard') showAnswer = !showAnswer;
	}
	function nextCard() {
		if (queue.length) {
			index = (index + 1) % queue.length;
			showAnswer = false;
			persist();
		}
	}
	function prevCard() {
		if (queue.length) {
			index = (index - 1 + queue.length) % queue.length;
			showAnswer = false;
			persist();
		}
	}

	function mark(isCorrect) {
		if (!current) return;
		const updated = scheduleResult(current, isCorrect);

		// replace SRS card
		cards = cards.map((c) => (c.id === updated.id ? updated : c));
		appendReviewLog({ id: updated.id, kana: updated.kana, romaji: updated.romaji, ok: isCorrect });

		if (isCorrect) correctCount++;
		else incorrectCount++;

		// Remove from queue if it's no longer due (when dueOnly)
		const nowDue = updated.due <= Date.now();
		const shouldStay = !dueOnly || nowDue;
		if (!shouldStay) {
			queue = queue.filter((q) => q !== updated.id);
			if (index >= queue.length) index = Math.max(0, queue.length - 1);
		} else {
			nextCard();
		}
		if (queue.length === 0) rebuildQueue();
		persist();
	}

	function resetAll() {
		cards = cards.map((c) => initSrsCard({ kana: c.kana, romaji: c.romaji }));
		correctCount = 0;
		incorrectCount = 0;
		rebuildQueue();
		persist();
	}
	function reshuffleKeepStats() {
		rebuildQueue();
		persist();
	}

	// Multiple choice helpers
	function displayPrompt(card) {
		return !card ? '' : direction === 'kanaToRomaji' ? card.kana : card.romaji;
	}
	function displayAnswer(card) {
		return !card ? '' : direction === 'kanaToRomaji' ? card.romaji : card.kana;
	}
	function getChoicePool() {
		const key = direction === 'kanaToRomaji' ? 'romaji' : 'kana';
		return Array.from(new Set(cards.map((c) => c[key])));
	}
	function makeChoices(card) {
		const pool = getChoicePool().filter((v) => v !== displayAnswer(card));
		const distractors = shuffle(pool).slice(0, 3);
		return shuffle([displayAnswer(card), ...distractors]);
	}
	let currentChoices = [];
	$: if (mode === 'choice' && current) currentChoices = makeChoices(current);

	function answerChoice(choice) {
		const ok = choice === displayAnswer(current);
		mark(ok);
	}

	async function playAudio() {
		if (current) playCardAudio(current);
	}

	// Keyboard shortcuts
	function handleKeys(e) {
		const tag = (e.target && e.target.tagName) || '';
		if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
		switch (e.key.toLowerCase()) {
			case 'f':
				if (mode === 'flashcard') {
					e.preventDefault();
					flip();
				}
				break;
			case 'j':
			case 'arrowright':
				e.preventDefault();
				nextCard();
				break;
			case 'k':
			case 'arrowleft':
				e.preventDefault();
				prevCard();
				break;
			case 'y':
				e.preventDefault();
				mark(true);
				break;
			case 'n':
				e.preventDefault();
				mark(false);
				break;
			case 'r':
				e.preventDefault();
				reshuffleKeepStats();
				break;
			case 'd':
				e.preventDefault();
				direction = direction === 'kanaToRomaji' ? 'romajiToKana' : 'kanaToRomaji';
				persist();
				if (mode === 'choice' && current) currentChoices = makeChoices(current);
				break;
			case 'm':
				e.preventDefault();
				mode = mode === 'flashcard' ? 'choice' : 'flashcard';
				persist();
				break;
			case 'a':
				e.preventDefault();
				playAudio();
				break; // NEW: audio
			case '1':
			case '2':
			case '3':
			case '4':
				if (mode === 'choice') {
					const idx = parseInt(e.key, 10) - 1;
					if (currentChoices[idx] != null) {
						e.preventDefault();
						answerChoice(currentChoices[idx]);
					}
				}
				break;
		}
	}

	// Quick-select helpers
	function selectHiragana() {
		selectedDeckIds = new Set(['basic', 'dakuten', 'yoon']);
		applyDeckSelection();
	}
	function selectKatakana() {
		selectedDeckIds = new Set(['kata_basic', 'kata_dakuten', 'kata_yoon', 'kata_loan']);
		applyDeckSelection();
	}
	function selectBoth() {
		selectedDeckIds = new Set([
			'basic',
			'dakuten',
			'yoon',
			'kata_basic',
			'kata_dakuten',
			'kata_yoon',
			'kata_loan'
		]);
		applyDeckSelection();
	}
	function selectNone() {
		selectedDeckIds = new Set();
		applyDeckSelection();
	}
</script>

<svelte:head>
	<title>Hiragana Trainer — SRS</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="container">
	<header>
		<h1>Hiragana Trainer</h1>
		<nav><a href="/stats" aria-label="Stats">📊 Stats</a></nav>
		<div class="stats">
			<span>Queue: {progress}</span>
			<span>✅ {correctCount}</span>
			<span>❌ {incorrectCount}</span>
			<span title="Overall accuracy across cards">Acc: {summary.acc}%</span>
			<span title="Cards due right now">Due: {summary.dueNow}/{summary.total}</span>
		</div>
	</header>

	<section class="controls">
		<fieldset>
			<legend>Decks</legend>
			<!-- Quick filters -->
			<div class="filter-row">
				<button class="chip" on:click={selectHiragana} title="All Hiragana">Hiragana</button>
				<button class="chip" on:click={selectKatakana} title="All Katakana">Katakana</button>
				<button class="chip" on:click={selectBoth} title="Both scripts">Both</button>
				<button class="chip" on:click={selectNone} title="Clear selection">None</button>
			</div>
			{#each Object.values(ALL_DECKS) as d}
				<label>
					<input
						type="checkbox"
						checked={selectedDeckIds.has(d.id)}
						on:change={(e) => {
							e.target.checked ? selectedDeckIds.add(d.id) : selectedDeckIds.delete(d.id);
							applyDeckSelection();
						}}
					/>
					{d.label}
				</label>
			{/each}
		</fieldset>

		<fieldset>
			<legend>Mode</legend>
			<label
				><input type="radio" name="mode" value="flashcard" bind:group={mode} on:change={persist} /> Flashcard
				(F/Y/N)</label
			>
			<label
				><input type="radio" name="mode" value="choice" bind:group={mode} on:change={persist} /> Multiple
				choice (1–4)</label
			>
		</fieldset>

		<fieldset>
			<legend>Direction</legend>
			<label
				><input
					type="radio"
					name="dir"
					value="kanaToRomaji"
					bind:group={direction}
					on:change={() => {
						persist();
						current && (currentChoices = makeChoices(current));
					}}
				/> Kana → Romaji</label
			>
			<label
				><input
					type="radio"
					name="dir"
					value="romajiToKana"
					bind:group={direction}
					on:change={() => {
						persist();
						current && (currentChoices = makeChoices(current));
					}}
				/> Romaji → Kana</label
			>
		</fieldset>

		<fieldset>
			<legend>Scheduling</legend>
			<label
				><input
					type="checkbox"
					bind:checked={dueOnly}
					on:change={() => {
						rebuildQueue();
						persist();
					}}
				/> Study due only</label
			>
			<div class="small">If nothing is due, next soonest cards appear.</div>
		</fieldset>
	</section>

	<main>
		{#if !queue.length}
			<p>No cards in the queue. Either nothing is due or no decks are selected.</p>
			<div class="toolbar">
				<button on:click={rebuildQueue}>Rebuild queue</button>
				<button on:click={reshuffleKeepStats}>Reshuffle (keep stats)</button>
				<button on:click={resetAll} title="Reset all due dates & boxes to Box 1">Full reset</button>
			</div>
		{:else if mode === 'flashcard'}
			<div class="card" on:click={flip} aria-role="button" tabindex="0" title="Click or F to flip">
				<button class="speak" on:click|stopPropagation={playAudio} title="Play audio (A)">🔊</button
				>
				<div class="face prompt">{displayPrompt(current)}</div>
				{#if showAnswer}<div class="face answer">{displayAnswer(current)}</div>{/if}
				<div class="meta">Box {current?.box} • {new Date(current?.due || 0).toLocaleString()}</div>
			</div>
			<div class="action-row">
				<button on:click={prevCard}>&larr; Prev (K)</button>
				<button on:click={() => mark(false)}>I forgot (N)</button>
				<button class="primary" on:click={() => mark(true)}>I knew it (Y)</button>
				<button on:click={nextCard}>Next (J) &rarr;</button>
			</div>
		{:else}
			<div class="card">
				<button class="speak" on:click={playAudio} title="Play audio (A)">🔊</button>
				<div class="face prompt">{displayPrompt(current)}</div>
				<div class="meta">Box {current?.box} • {new Date(current?.due || 0).toLocaleString()}</div>
			</div>
			<div class="choices">
				{#each currentChoices as c, i}
					<button class="choice" on:click={() => answerChoice(c)}
						><span class="key">{i + 1}</span> {c}</button
					>
				{/each}
			</div>
		{/if}

		<div class="toolbar">
			<button on:click={reshuffleKeepStats}>Reshuffle & rebuild queue</button>
			<button on:click={resetAll} title="Reset all SRS stats">Full reset</button>
		</div>
	</main>
</div>

<style>
	:global(html, body, #svelte) {
		height: 100%;
	}
	.container {
		max-width: 860px;
		margin: 0 auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 1.5rem;
		margin: 0;
	}
	nav a {
		text-decoration: none;
	}
	.stats {
		display: flex;
		gap: 0.75rem;
		font-size: 0.95rem;
		opacity: 0.9;
		flex-wrap: wrap;
	}
	.small {
		opacity: 0.7;
		font-size: 0.9rem;
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	fieldset {
		border: 1px solid hsl(0 0% 85%);
		border-radius: 12px;
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}
	legend {
		font-weight: 600;
		padding: 0 0.25rem;
	}
	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.card {
		user-select: none;
		display: grid;
		place-items: center;
		min-height: 40vh;
		border: 2px solid hsl(0 0% 80%);
		border-radius: 16px;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
		padding: 2rem;
		position: relative;
		text-align: center;
	}
	.speak {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		border: 1px solid hsl(0 0% 80%);
		background: white;
		border-radius: 10px;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
	}
	.face.prompt {
		font-size: clamp(4rem, 9vw, 8rem);
		line-height: 1;
	}
	.face.answer {
		margin-top: 0.5rem;
		font-size: clamp(1.2rem, 3vw, 2rem);
		opacity: 0.9;
	}
	.meta {
		position: absolute;
		bottom: 0.75rem;
		right: 1rem;
		font-size: 0.8rem;
		opacity: 0.65;
	}

	.action-row,
	.toolbar {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}
	button {
		border: 1px solid hsl(0 0% 80%);
		padding: 0.6rem 1rem;
		border-radius: 12px;
		background: white;
		cursor: pointer;
		font-size: 1rem;
	}
	button.primary {
		background: hsl(140 70% 40%);
		color: white;
		border-color: transparent;
	}
	button:hover {
		filter: brightness(0.98);
	}
	.choice .key {
		display: inline-block;
		min-width: 1.3rem;
		text-align: center;
		border: 1px solid hsl(0 0% 80%);
		border-radius: 8px;
		margin-right: 0.5rem;
		font-size: 0.9rem;
		padding: 0.05rem 0.25rem;
		opacity: 0.8;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}
	.chip {
		border: 1px solid hsl(0 0% 80%);
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: white;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.chip:hover {
		filter: brightness(0.98);
	}
</style>
