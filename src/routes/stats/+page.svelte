<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { ALL_DECKS } from '$lib/data/decks.js';

  const STORAGE_KEY = 'hiraganaSettings:v3';
  const REVIEW_LOG_KEY = 'hiraganaReviewLog:v1';

  let state = null;     // saved SRS state
  let log = [];         // review events
  let ready = false;

  // Aggregates
  let overall = { seen: 0, correct: 0, acc: 0 };
  let boxes = []; // [{box, count}]
  let perDeck = []; // [{id,label, seen, correct, acc}]
  let last7 = []; // [{date, seen, correct, acc}]

  function load() {
    if (!browser) { ready = true; return; } 
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { state = null; }
    try { log = JSON.parse(localStorage.getItem(REVIEW_LOG_KEY) || '[]'); } catch { log = []; }

    computeAggregates();
    ready = true;
  }

  function computeAggregates() {
    // Overall (from log)
    const seen = log.length;
    const correct = log.filter(e => e.ok).length;
    const acc = seen ? Math.round((correct / seen) * 100) : 0;
    overall = { seen, correct, acc };

    // Boxes (from state.cards)
    const boxMap = new Map();
    (state?.cards || []).forEach(c => {
      const b = c.box || 1;
      boxMap.set(b, (boxMap.get(b) || 0) + 1);
    });
    boxes = Array.from({ length: 5 }, (_, i) => {
      const b = i + 1;
      return { box: b, count: boxMap.get(b) || 0 };
    });

    // Per-deck: classify by current deck definitions (kana+romaji)
    const decks = Object.values(ALL_DECKS).map(d => ({ id: d.id, label: d.label, set: new Set(d.cards.map(c => c.kana + '__' + c.romaji)) }));
    const deckStats = decks.map(d => ({ id: d.id, label: d.label, seen: 0, correct: 0 }));
    for (const e of log) {
      const key = e.kana + '__' + e.romaji;
      deckStats.forEach(ds => {
        if (ds.set.has(key)) {
          ds.seen += 1;
          if (e.ok) ds.correct += 1;
        }
      });
    }
    perDeck = deckStats.map(ds => ({ ...ds, acc: ds.seen ? Math.round((ds.correct / ds.seen) * 100) : 0 }));

    // Last 7 calendar days
    const byDay = new Map();
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      byDay.set(key, { seen: 0, correct: 0 });
    }
    for (const e of log) {
      const key = new Date(e.t).toISOString().slice(0, 10);
      if (byDay.has(key)) {
        const x = byDay.get(key);
        x.seen += 1;
        if (e.ok) x.correct += 1;
      }
    }
    last7 = Array.from(byDay.entries()).map(([date, v]) => ({
      date,
      seen: v.seen,
      correct: v.correct,
      acc: v.seen ? Math.round((v.correct / v.seen) * 100) : 0
    }));
  }

  function clearStats() {
    if (!browser) return;
    if (!confirm('This will clear all review logs and SRS state. Continue?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REVIEW_LOG_KEY);
    load();
  }

  onMount(load);
</script>

<svelte:head>
  <title>Hiragana Trainer — Stats</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="wrap">
  <header>
    <h1>📊 Stats</h1>
    <nav><a href="/">← Back to study</a></nav>
  </header>

  {#if !ready}
    <p>Loading…</p>
  {:else}
    <section class="cards">
      <div class="card">
        <h2>Overall</h2>
        <div class="big">{overall.acc}%</div>
        <div class="sub">Accuracy</div>
        <div class="row">Seen: <strong>{overall.seen}</strong></div>
        <div class="row">Correct: <strong>{overall.correct}</strong></div>
      </div>

      <div class="card">
        <h2>Boxes</h2>
        <div class="bars">
          {#each boxes as b}
            <div class="bar">
              <div class="label">Box {b.box}</div>
              <div class="track"><div class="fill" style="width: {Math.min(100, (b.count / Math.max(1, state?.cards?.length || 1))*100)}%"></div></div>
              <div class="count">{b.count}</div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Per deck</h2>
      <table>
        <thead><tr><th>Deck</th><th>Seen</th><th>Correct</th><th>Accuracy</th></tr></thead>
        <tbody>
          {#each perDeck as d}
            <tr>
              <td>{d.label}</td>
              <td>{d.seen}</td>
              <td>{d.correct}</td>
              <td>{d.acc}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>Last 7 days</h2>
      <div class="spark">
        {#each last7 as d}
          <div class="col" title="{d.date}: {d.seen} seen, {d.acc}%">
            <div class="col-fill" style="height: {Math.min(100, d.seen ? (d.seen / Math.max(1, Math.max(...last7.map(x => x.seen))))*100 : 2)}%"></div>
            <div class="col-label">{d.date.slice(5)}</div>
          </div>
        {/each}
      </div>
      <div class="legend">Bar height = reviews/day • Hover for details</div>
    </section>

    <div class="actions">
      <button class="danger" on:click={clearStats}>Clear all stats</button>
    </div>
  {/if}
</div>

<style>
  .wrap { max-width: 980px; margin: 0 auto; padding: 1rem; display: grid; gap: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  header a { text-decoration: none; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; }
  .card { border: 1px solid hsl(0 0% 85%); border-radius: 12px; padding: 1rem; background: white; }
  h2 { margin-top: 0; }
  .big { font-size: 2.4rem; font-weight: 700; }
  .sub { opacity: 0.7; margin-bottom: 0.5rem; }
  .row { margin-top: 0.25rem; }

  .bars { display: grid; gap: 0.5rem; }
  .bar { display: grid; grid-template-columns: 80px 1fr 48px; align-items: center; gap: 0.5rem; }
  .track { background: hsl(0 0% 92%); height: 10px; border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; background: hsl(140 70% 40%); }

  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid hsl(0 0% 90%); padding: 0.5rem; text-align: left; }
  tbody tr:hover { background: hsl(0 0% 98%); }

  .spark { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; align-items: end; height: 120px; padding: 0.5rem 0; }
  .col { display: grid; grid-template-rows: 1fr auto; gap: 0.25rem; }
  .col-fill { background: hsl(220 60% 60%); border-radius: 6px; min-height: 4px; }
  .col-label { text-align: center; font-size: 0.8rem; opacity: 0.7; }
  .legend { opacity: 0.65; font-size: 0.9rem; margin-top: 0.5rem; }

  .actions { display: flex; justify-content: flex-end; }
  .danger { border: 1px solid #c33; color: white; background: #c33; border-radius: 10px; padding: 0.5rem 0.9rem; cursor: pointer; }
</style>
