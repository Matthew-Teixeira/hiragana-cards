// Simple Leitner-like spaced repetition
// Boxes (1..5) → next due offsets
const BOX_INTERVALS_MS = {
  1: 60 * 1000,          // 1 minute
  2: 10 * 60 * 1000,     // 10 minutes
  3: 24 * 60 * 60 * 1000,// 1 day
  4: 3 * 24 * 60 * 60 * 1000, // 3 days
  5: 7 * 24 * 60 * 60 * 1000  // 7 days
};

// Create a stable id (deck-agnostic) for each card
export function makeId(card) {
  return `${card.kana}__${card.romaji}`;
}

export function initSrsCard(card) {
  const now = Date.now();
  return {
    ...card,
    id: makeId(card),
    box: 1,
    due: now,           // due immediately
    seen: 0,            // total attempts
    correct: 0          // total correct
  };
}

export function scheduleResult(card, wasCorrect) {
  const now = Date.now();
  const nextBox = wasCorrect ? Math.min(5, (card.box || 1) + 1) : 1;
  const interval = BOX_INTERVALS_MS[nextBox] || BOX_INTERVALS_MS[1];
  return {
    ...card,
    box: nextBox,
    due: now + interval,
    seen: (card.seen || 0) + 1,
    correct: (card.correct || 0) + (wasCorrect ? 1 : 0)
  };
}

export function mergeExistingStats(rawCards, existingById) {
  // Keep old SRS stats when present, otherwise initialize.
  return rawCards.map(c => {
    const id = makeId(c);
    const old = existingById[id];
    return old ? { ...old, kana: c.kana, romaji: c.romaji, id } : initSrsCard(c);
  });
}

export function stats(cards) {
  const total = cards.length;
  const dueNow = cards.filter(c => c.due <= Date.now()).length;
  const seen = cards.reduce((a, c) => a + (c.seen || 0), 0);
  const correct = cards.reduce((a, c) => a + (c.correct || 0), 0);
  const acc = seen ? Math.round((correct / seen) * 100) : 0;
  return { total, dueNow, seen, correct, acc };
}
