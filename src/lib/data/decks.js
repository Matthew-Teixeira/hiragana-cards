import hira_basic from './hiragana.js';
import hira_dakuten from './hiragana_dakuten.js';
import hira_yoon from './hiragana_yoon.js';

import kata_basic from './katakana.js';
import kata_dakuten from './katakana_dakuten.js';
import kata_yoon from './katakana_yoon.js';
import kata_loan from './katakana_loanwords.js';        // <-- ADD

export const ALL_DECKS = {
  // Hiragana
  basic:   { id: 'basic',   label: 'Hiragana — Basic (あ〜ん)', cards: hira_basic },
  dakuten: { id: 'dakuten', label: 'Hiragana — Dakuten/Handakuten (が〜ぽ)', cards: hira_dakuten },
  yoon:    { id: 'yoon',    label: 'Hiragana — Yōon combos (きゃ〜りょ)', cards: hira_yoon },

  // Katakana
  kata_basic:   { id: 'kata_basic',   label: 'Katakana — Basic (ア〜ン)', cards: kata_basic },
  kata_dakuten: { id: 'kata_dakuten', label: 'Katakana — Dakuten/Handakuten (ガ〜ポ)', cards: kata_dakuten },
  kata_yoon:    { id: 'kata_yoon',    label: 'Katakana — Yōon combos (キャ〜リョ)', cards: kata_yoon },
  kata_loan:    { id: 'kata_loan',    label: 'Katakana — Loanwords (外来語)', cards: kata_loan } // <-- NEW
};
