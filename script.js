/**
 * =============================================================================
 * SCRIPT.JS — behavior + POST to your Render Qualtrics proxy (tutorial)
 * =============================================================================
 *
 * PREREQUISITES
 * -------------
 * - index.html loads **config.js** and **sentiment.js** before this file.
 * - Every element we touch has the `id` shown in index.html.
 *
 * THE DATA PIPELINE (end-to-end)
 * ------------------------------
 * 1. User adjusts QID1 (slider), picks QID2 (button), types QID3_TEXT (textarea).
 * 2. On submit we build `values` with Qualtrics response metadata (startDate,
 *    endDate, status, finished) plus question IDs — same idea as HeartbeatProject.
 * 3. We wrap that in `payload` with surveyId + datacenter from config.
 * 4. `fetch(..., { method: 'POST', body: JSON.stringify(payload) })` sends JSON
 *    to your proxy. The proxy should validate, attach API secrets server-side,
 *    and call Qualtrics.
 * 5. We read the response as text first, try `JSON.parse`, and log everything.
 *
 * WHY AN IIFE WRAPPER `(function () { ... })();`
 * ---------------------------------------------
 * Immediately Invoked Function Expression: runs once, keeps our `const`/`let`
 * variables out of the global scope so we do not accidentally overwrite other
 * scripts’ names on `window`.
 */

(function () {
  function initVibeSurvey() {
    const cfg = window.VIBE_SURVEY_CONFIG;
    if (!cfg || !cfg.PROXY_URL) {
      console.error('VIBE_SURVEY_CONFIG missing; load config.js first.');
      return;
    }

    const slider = document.getElementById('qid1-slider');
    const sliderOut = document.getElementById('qid1-output');
    const arcSvg = document.getElementById('nps-arc-svg');
    const npsThumb = document.getElementById('nps-thumb');
    const npsTicks = document.getElementById('nps-ticks');
    const quantumRow = document.getElementById('quantum-row');
    const qid2Hidden = document.getElementById('qid2-value');
    const textarea = document.getElementById('qid3-text');
    const surveyForm = document.getElementById('survey-form');
    const submitBtn = document.getElementById('survey-submit');
    const toast = document.getElementById('toast');
    const submitFeedback = document.getElementById('submit-feedback');
    const surveyFlow = document.getElementById('survey-flow');
    const surveyThanks = document.getElementById('survey-thanks');
    const thanksMsg = document.getElementById('survey-thanks-msg');

    if (
      !slider ||
      !sliderOut ||
      !arcSvg ||
      !npsThumb ||
      !npsTicks ||
      !quantumRow ||
      !qid2Hidden ||
      !textarea ||
      !toast
    ) {
      console.error('Vibe survey: a required element is missing from the page (check ids in index.html).');
      return;
    }
    if (!surveyForm || !submitBtn || !surveyFlow || !surveyThanks || !thanksMsg) {
      console.error('Vibe survey: form, submit button, or thanks panel missing.');
      return;
    }

    function setSubmitFeedback(message, isError) {
      if (!submitFeedback) return;
      if (!message) {
        submitFeedback.textContent = '';
        submitFeedback.hidden = true;
        submitFeedback.classList.remove('submit-feedback--error');
        return;
      }
      submitFeedback.textContent = message;
      submitFeedback.hidden = false;
      submitFeedback.classList.toggle('submit-feedback--error', !!isError);
    }

    /* =========================================================================
     * QID1 — Arc rail: 0 and 10 at the ends (bottom), 5 at the apex (matches SVG path)
     * ========================================================================= */
    const NPS_CX = 160;
    const NPS_CY = 130;
    const NPS_R = 120;

    function npsTheta(v) {
      return Math.PI * (1 - v / 10);
    }

    function npsXY(v) {
      const θ = npsTheta(v);
      return {
        x: NPS_CX + NPS_R * Math.cos(θ),
        y: NPS_CY - NPS_R * Math.sin(θ),
      };
    }

    function buildNpsTicks() {
      npsTicks.replaceChildren();
      const NS = 'http://www.w3.org/2000/svg';
      for (let v = 0; v <= 10; v++) {
        const θ = npsTheta(v);
        const { x, y } = npsXY(v);
        const cos = Math.cos(θ);
        const sin = Math.sin(θ);
        const tickLen = 10;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(x - tickLen * cos));
        line.setAttribute('y2', String(y + tickLen * sin));
        line.setAttribute('class', 'nps-tick-line');
        line.dataset.value = String(v);
        const labelR = 18;
        const tx = x + labelR * cos;
        const ty = y - labelR * sin;
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(tx));
        text.setAttribute('y', String(ty));
        text.setAttribute('class', 'nps-tick-num');
        text.setAttribute('dominant-baseline', 'middle');
        text.dataset.value = String(v);
        text.textContent = String(v);
        npsTicks.appendChild(line);
        npsTicks.appendChild(text);
      }
    }

    /** Map pointer to a continuous 0–10 along the semicircle (5 at the apex). */
    function npsPointerToContinuous(clientX, clientY) {
      const pt = arcSvg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = arcSvg.getScreenCTM();
      if (!ctm) return Number(slider.value);
      const p = pt.matrixTransform(ctm.inverse());
      const mx = p.x;
      const my = p.y;
      if (my >= NPS_CY - 0.5) {
        return mx < NPS_CX ? 0 : 10;
      }
      let θ = Math.atan2(NPS_CY - my, mx - NPS_CX);
      if (θ < 0) θ = 0;
      if (θ > Math.PI) θ = Math.PI;
      const v = 10 * (1 - θ / Math.PI);
      return Math.min(10, Math.max(0, v));
    }

    function syncSlider() {
      const raw = Number(slider.value);
      const rounded = Math.round(raw);
      sliderOut.textContent = String(rounded);
      slider.setAttribute('aria-valuenow', String(rounded));
    }

    function syncNpsArcVisual() {
      const v = Number(slider.value);
      const { x, y } = npsXY(v);
      npsThumb.setAttribute('cx', String(x));
      npsThumb.setAttribute('cy', String(y));
      const r = Math.round(v);
      npsTicks.querySelectorAll('[data-value]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.value === String(r));
      });
    }

    function onQ1Input() {
      syncSlider();
      syncNpsArcVisual();
    }

    /** After any user move, gravity stays off briefly so the ball doesn’t fight the pointer/keyboard. */
    let npsGravityPausedUntil = 0;
    const NPS_GRAVITY_USER_PAUSE_MS = 2000;
    /** Velocity (score units per frame) builds each frame → slow start, then faster roll. */
    let npsGravityVel = 0;
    const NPS_GRAVITY_ACCEL = 0.00026;
    const NPS_GRAVITY_MAX_VEL = 0.032;

    function bumpNpsGravityPause() {
      npsGravityPausedUntil = Date.now() + NPS_GRAVITY_USER_PAUSE_MS;
      npsGravityVel = 0;
    }

    function applyNpsFromPointer(ev) {
      const v = npsPointerToContinuous(ev.clientX, ev.clientY);
      const cur = Number(slider.value);
      if (Math.abs(cur - v) < 0.0008) return;
      bumpNpsGravityPause();
      slider.value = String(v);
      onQ1Input();
    }

    let npsGravityRaf = 0;
    function npsGravityFrame() {
      if (!npsDragging && Date.now() >= npsGravityPausedUntil) {
        let v = Number(slider.value);
        const atRest = v <= 0 || v >= 10;
        const atApex = Math.abs(v - 5) < 1e-4;

        if (atRest || atApex) {
          npsGravityVel = 0;
        } else if (v < 5) {
          if (npsGravityVel > 1e-8) npsGravityVel = 0;
          npsGravityVel -= NPS_GRAVITY_ACCEL;
          if (npsGravityVel < -NPS_GRAVITY_MAX_VEL) npsGravityVel = -NPS_GRAVITY_MAX_VEL;
          v += npsGravityVel;
          if (v <= 0) {
            v = 0;
            npsGravityVel = 0;
          }
          slider.value = String(v);
          onQ1Input();
        } else if (v > 5) {
          if (npsGravityVel < -1e-8) npsGravityVel = 0;
          npsGravityVel += NPS_GRAVITY_ACCEL;
          if (npsGravityVel > NPS_GRAVITY_MAX_VEL) npsGravityVel = NPS_GRAVITY_MAX_VEL;
          v += npsGravityVel;
          if (v >= 10) {
            v = 10;
            npsGravityVel = 0;
          }
          slider.value = String(v);
          onQ1Input();
        }
      } else if (npsDragging || Date.now() < npsGravityPausedUntil) {
        npsGravityVel = 0;
      }
      npsGravityRaf = window.requestAnimationFrame(npsGravityFrame);
    }

    buildNpsTicks();
    slider.addEventListener('input', () => {
      bumpNpsGravityPause();
      onQ1Input();
    });
    onQ1Input();
    npsGravityRaf = window.requestAnimationFrame(npsGravityFrame);

    let npsDragging = false;
    arcSvg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      bumpNpsGravityPause();
      npsDragging = true;
      arcSvg.setPointerCapture(e.pointerId);
      applyNpsFromPointer(e);
    });
    arcSvg.addEventListener('pointermove', (e) => {
      if (!npsDragging) return;
      bumpNpsGravityPause();
      applyNpsFromPointer(e);
    });
    function npsPointerEnd(e) {
      if (npsDragging && e.pointerId != null) {
        try {
          arcSvg.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      npsDragging = false;
    }
    arcSvg.addEventListener('pointerup', npsPointerEnd);
    arcSvg.addEventListener('pointercancel', npsPointerEnd);
    arcSvg.addEventListener('lostpointercapture', () => {
      npsDragging = false;
    });

    /* =========================================================================
     * QID2 — “Quantum” buttons: shuffle order or jitter on hover
     * ========================================================================= */
    function shuffleQuantumChildren() {
      const buttons = Array.from(quantumRow.querySelectorAll('.quantum-btn'));
      for (let i = buttons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
      }
      const frag = document.createDocumentFragment();
      buttons.forEach((b) => frag.appendChild(b));
      quantumRow.appendChild(frag);
    }

    function jitterQuantumButtons() {
      const buttons = quantumRow.querySelectorAll('.quantum-btn');
      buttons.forEach((btn) => {
        const dx = (Math.random() - 0.5) * 14;
        const dy = (Math.random() - 0.5) * 10;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      requestAnimationFrame(() => {
        quantumRow.querySelectorAll('.quantum-btn').forEach((btn) => {
          btn.style.transform = '';
        });
      });
    }

    quantumRow.querySelectorAll('.quantum-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        if (Math.random() < 0.55) shuffleQuantumChildren();
        else jitterQuantumButtons();
      });
      btn.addEventListener('click', () => {
        quantumRow.querySelectorAll('.quantum-btn').forEach((b) => {
          b.setAttribute('aria-checked', 'false');
        });
        btn.setAttribute('aria-checked', 'true');
        qid2Hidden.value = btn.getAttribute('data-choice') || '';
      });
    });

    /* =========================================================================
     * QID3_TEXT — sentiment tint via sentiment.js (red / green vs neutral purple)
     * ========================================================================= */
    if (!window.vibeSentiment) {
      console.error('Load sentiment.js before script.js (window.vibeSentiment missing).');
    } else {
      textarea.addEventListener('input', () => {
        window.vibeSentiment.applyToTextarea(textarea);
      });
    }

    /* =========================================================================
     * Submit → build payload → fetch(proxy) → thanks view (text mood vs NPS)
     * ========================================================================= */

    /** NPS buckets: classic promoter / passive / detractor. */
    function moodFromNps(npsRounded) {
      if (npsRounded <= 6) return 'negative';
      if (npsRounded <= 8) return 'neutral';
      return 'positive';
    }

    function moodFromTextAnalysis(analysis) {
      const s = analysis.score;
      if (s > 0.05) return 'positive';
      if (s < -0.05) return 'negative';
      return 'neutral';
    }

    function textMoodLabel(m) {
      if (m === 'positive') return 'positive';
      if (m === 'negative') return 'negative';
      return 'neutral or mixed';
    }

    function getTextAnalysisForThanks() {
      if (!window.vibeSentiment) return { score: 0, pos: 0, neg: 0 };
      const toks = window.vibeSentiment.tokens(textarea.value);
      return window.vibeSentiment.analyzeTokens(toks);
    }

    /**
     * Thank-you copy from open text + rounded NPS. If lexicon mood and NPS bucket disagree,
     * append a gently confused aside (no user HTML — only our strings).
     */
    function buildThankYouCopy(npsRounded, analysis) {
      const textMood = moodFromTextAnalysis(analysis);
      const npsMood = moodFromNps(npsRounded);
      const label = textMoodLabel(textMood);
      const mainOpen = `Thank you for submitting this ${label} feedback.`;

      if (textMood === npsMood) {
        return {
          main:
            `${mainOpen} Your words and your score mostly pointed the same way—refreshing when reality lines up.`,
          confused: null,
        };
      }

      let confused;
      if (textMood === 'positive') {
        confused =
          npsMood === 'negative'
            ? 'We’re slightly confused: the write-up sounded warm, but the score looked pretty frosty. We logged it anyway—people are layered.'
            : 'We’re slightly confused: upbeat prose, yet the score sat in the mushy middle. Filed with a polite eyebrow raise—thank you.';
      } else if (textMood === 'negative') {
        confused =
          npsMood === 'positive'
            ? 'We’re slightly confused: the text had some bite, while the NPS was almost suspiciously sunny. Stored with a shrug—thanks for the plot twist.'
            : 'We’re slightly confused: salty words paired with a lukewarm number. Both corners saved; we’re not here to pick a winner.';
      } else {
        confused =
          npsMood === 'positive'
            ? 'We’re slightly confused: the wording read calm or mixed, but the score was ready to shout your praises. Archaeologists will love this.'
            : npsMood === 'negative'
              ? 'We’re slightly confused: diplomatic tone, chilly digit. We kept both and we’re not taking sides.'
              : 'We’re slightly confused: everything insisted on sitting in the middle. Respect.';
      }

      return { main: mainOpen, confused };
    }

    function showThanksAfterSuccess() {
      const npsR = Math.round(Number(slider.value));
      const analysis = getTextAnalysisForThanks();
      const copy = buildThankYouCopy(npsR, analysis);

      thanksMsg.textContent = '';
      const lead = document.createElement('span');
      lead.textContent = copy.main;
      thanksMsg.appendChild(lead);
      if (copy.confused) {
        const aside = document.createElement('span');
        aside.className = 'thanks-muted';
        aside.textContent = copy.confused;
        thanksMsg.appendChild(aside);
      }

      surveyFlow.hidden = true;
      surveyThanks.hidden = false;
      surveyThanks.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    let submitInFlight = false;

    async function handleSurveySubmit() {
      if (submitInFlight) return;
      submitInFlight = true;
      submitBtn.disabled = true;
      setSubmitFeedback('Sending…', false);

      /*
       * Qualtrics “create response” expects a small envelope inside `values`, not
       * only question IDs. HeartbeatProject sends the same shape — without
       * startDate / endDate / status / finished, the API often returns HTTP 400.
       */
      const now = new Date().toISOString();
      const q2Raw = qid2Hidden.value;
      const values = {
        startDate: now,
        endDate: now,
        status: 0,
        finished: 1,
        QID1: Math.round(Number(slider.value)),
        ...(q2Raw !== '' ? { QID2: Number(q2Raw) } : {}),
        QID3_TEXT: textarea.value,
        OriginHost: window.location.hostname || 'local-vibe-test',
      };

      const payload = {
        datacenter: cfg.DATA_CENTER,
        surveyId: cfg.SURVEY_ID,
        values,
      };

      try {
        const res = await fetch(cfg.PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let bodyText = await res.text();
        let parsed = null;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          parsed = bodyText;
        }

        const full = { status: res.status, statusText: res.statusText, body: parsed };
        console.log('Qualtrics proxy response:', full);

        if (!res.ok) {
          console.error('Submit failed', full);
          setSubmitFeedback(`Server returned ${res.status}. Open the console for details.`, true);
          return;
        }

        setSubmitFeedback('');
        showThanksAfterSuccess();
      } catch (err) {
        console.error('Network or fetch error:', err);
        setSubmitFeedback('Network or CORS error — check the console.', true);
      } finally {
        submitBtn.disabled = false;
        submitInFlight = false;
      }
    }

    /*
     * Primary path: direct click on #survey-submit (always fires for real clicks).
     * preventDefault stops the browser’s default navigation; we POST via fetch instead.
     */
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      void handleSurveySubmit();
    });

    /*
     * Backup: form `submit` (Enter in some contexts, or assistive tech). `submitInFlight`
     * prevents a double POST if both `click` and `submit` fire for one activation.
     */
    surveyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      void handleSurveySubmit();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVibeSurvey);
  } else {
    initVibeSurvey();
  }
})();
