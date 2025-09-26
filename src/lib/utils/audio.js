// src/lib/utils/audio.js
let cachedVoice = null;

function getSS() {
  // safe handle for speechSynthesis in browsers only
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;
}

function pickJaVoice() {
  const ss = getSS();
  const voices = ss?.getVoices?.() || [];
  const preferred = [
    'Google 日本語', 'Google Japanese', 'Kyoko', 'Hattori', 'Otoya', 'Mizuki', 'Takumi', 'Sakura'
  ];
  for (const name of preferred) {
    const v = voices.find((x) => x.name?.includes?.(name) || x.lang === 'ja-JP');
    if (v) return v;
  }
  return voices.find((v) => v.lang === 'ja-JP') || null;
}

export function ensureVoicesLoaded() {
  return new Promise((resolve) => {
    const ss = getSS();
    if (!ss) return resolve(); // SSR or unsupported browser

    const load = () => { cachedVoice = pickJaVoice(); resolve(); };
    // voices can load async after first call
    ss.onvoiceschanged = () => { cachedVoice = pickJaVoice(); };
    ss.getVoices(); // trigger load
    setTimeout(load, 50);
  });
}

export function speakJapanese(text, { rate = 0.95, pitch = 1.0 } = {}) {
  const ss = getSS();
  if (!ss) return false;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = rate;
  utter.pitch = pitch;

  if (!cachedVoice) cachedVoice = pickJaVoice();
  if (cachedVoice) utter.voice = cachedVoice;

  ss.cancel();
  ss.speak(utter);
  return true;
}

export function playCardAudio(card) {
  if (!card) return false;
  return speakJapanese(card.kana);
}
