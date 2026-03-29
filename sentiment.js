/**
 * sentiment.js — tiny on-device “sentiment” from English keyword lists.
 *
 * Not NLP: no sarcasm, negation (“not good”), or languages other than the
 * word lists. Nothing is sent to a server. Exposes window.vibeSentiment for
 * script.js (and any other page script).
 *
 * Two+ matching words on the winning side → extra-saturated red/green.
 * Three+ → same + animated “spark” glow (classes on the textarea).
 */
(function (global) {
  const POSITIVE = new Set(
    'adore amazing awesome beautiful best better bless blessed brilliant calm care caring celebrate charming cheer cool confident cute delight delightful enjoy enjoyed excellent excited exciting fab fabulous fair fantastic favorite favourite fine friendly fun gem glad gold good gorgeous grateful great happier happiness happy heart hearts hope hoping hug incredible inspire inspiring joy joyful kind love loved lovely luck lucky marvel nice outstanding peace peaceful perfect pleased positive pretty proud recommend relaxed smile smiling success superb support supportive sweet thanks thank treasure warm win winning wonderful wow yes yay yeah'.split(
      /\s+/
    )
  );

  const NEGATIVE = new Set(
    'abysmal afraid alone angry annoy annoyed annoying awful bad bitter bleak broken crap cruel cry crying damn damned dark depressed depressing despair disaster disgust disgusting dumb empty evil exhausted fail failed failure fear frustrated frustrating garbage grim hate hated horrible horrid hurt hurting idiot ill lonely lose loser losing loss mad mean mistake mistakes mourn nasty never nightmare no nope pain pathetic rage regret ridiculous sad scared sick sorrow stress stressed stupid suck sucks terrible toxic trash ugly unfair upset vile worthless worry worse worst wrong'.split(
      /\s+/
    )
  );

  const SENT_CLASS_SPARK_POS = 'vibe-textarea--sent-spark-pos';
  const SENT_CLASS_SPARK_NEG = 'vibe-textarea--sent-spark-neg';

  function tokens(str) {
    const m = String(str)
      .toLowerCase()
      .match(/\b[a-z']+\b/g);
    return m || [];
  }

  function analyzeTokens(tokenList) {
    const out = { pos: 0, neg: 0, score: 0 };
    if (!tokenList || tokenList.length === 0) return out;
    for (let i = 0; i < tokenList.length; i++) {
      const w = tokenList[i];
      if (POSITIVE.has(w)) out.pos++;
      if (NEGATIVE.has(w)) out.neg++;
    }
    const net = out.pos - out.neg;
    if (net !== 0) {
      const damp = Math.sqrt(tokenList.length + 2);
      out.score = Math.max(-1, Math.min(1, (net / damp) * 1.15));
    }
    return out;
  }

  /** Roughly -1 … +1; 0 when empty or balanced hits. */
  function score(tokenList) {
    return analyzeTokens(tokenList).score;
  }

  /**
   * @param {'normal' | 'extra' | 'spark'} [tier] — two hits: extra saturation; three: spark (see CSS).
   */
  function toBackground(sentiment, tier) {
    const tierSafe = tier || 'normal';
    const x = Math.max(-1, Math.min(1, sentiment));
    if (Math.abs(x) < 0.05) {
      return 'hsl(265, 28%, 14%)';
    }
    const tMag = Math.min(1, Math.abs(x) / 0.9);
    const extraSat = tierSafe === 'extra' ? 14 : tierSafe === 'spark' ? 24 : 0;
    const extraLight = tierSafe === 'extra' ? 2 : tierSafe === 'spark' ? 4 : 0;
    let h;
    let sat;
    let light;
    if (x < 0) {
      h = 2 + tMag * 10;
      sat = 42 + 18 * tMag + extraSat;
      light = 11 + 4 * tMag + extraLight;
    } else {
      h = 118 + tMag * 32;
      sat = 38 + 20 * tMag + extraSat;
      light = 11 + 5 * tMag + extraLight;
    }
    sat = Math.min(96, sat);
    light = Math.min(24, light);
    return `hsl(${h.toFixed(1)}, ${sat.toFixed(1)}%, ${light.toFixed(1)}%)`;
  }

  /** @returns {'normal' | 'extra' | 'spark'} */
  function sentimentTier(s, pos, neg) {
    if (s > 0.05) {
      if (pos >= 3) return 'spark';
      if (pos >= 2) return 'extra';
      return 'normal';
    }
    if (s < -0.05) {
      if (neg >= 3) return 'spark';
      if (neg >= 2) return 'extra';
      return 'normal';
    }
    return 'normal';
  }

  function clearSentimentClasses(el) {
    el.classList.remove(SENT_CLASS_SPARK_POS, SENT_CLASS_SPARK_NEG);
  }

  function applyToTextarea(el) {
    clearSentimentClasses(el);
    const toks = tokens(el.value);
    if (toks.length === 0) {
      el.style.backgroundColor = '';
      return;
    }
    const { pos, neg, score: s } = analyzeTokens(toks);
    const tier = sentimentTier(s, pos, neg);
    el.style.backgroundColor = toBackground(s, tier);
    if (tier === 'spark') {
      el.classList.add(s > 0 ? SENT_CLASS_SPARK_POS : SENT_CLASS_SPARK_NEG);
    }
  }

  global.vibeSentiment = {
    tokens,
    score,
    analyzeTokens,
    toBackground,
    sentimentTier,
    applyToTextarea,
  };
})(typeof window !== 'undefined' ? window : globalThis);
