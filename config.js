/**
 * =============================================================================
 * CONFIG.JS — connect your frontend to the Qualtrics proxy (tutorial)
 * =============================================================================
 *
 * WHAT THIS FILE DOES
 * -------------------
 * Browsers cannot safely store Qualtrics API tokens. So a small server (your
 * "proxy" on Render) accepts POST requests from *your* pages, adds the secret
 * credentials on the server, and forwards answers to Qualtrics.
 *
 * This file holds **public** settings: the proxy URL and which survey to fill.
 * Anyone can read these in DevTools — that is normal. Security comes from the
 * proxy (rate limits, API keys on the server, optional origin checks), not from
 * hiding this file.
 *
 * HOW THE FRONTEND USES IT
 * ------------------------
 * We attach one object to `window` so plain `<script>` tags (no build step) can
 * share settings. `script.js` reads `window.VIBE_SURVEY_CONFIG` when submitting.
 *
 * KEYS YOUR PROXY LIKELY EXPECTS (match your Render handler!)
 * -----------------------------------------------------------
 * The demo `script.js` sends JSON like HeartbeatProject:
 *   { datacenter, surveyId, values: { startDate, endDate, status, finished,
 *     QID1, QID2?, QID3_TEXT, OriginHost } }
 * Omitting startDate/endDate/status/finished usually makes Qualtrics return 400.
 * If your proxy uses different field names, change **script.js** to match.
 *
 * QUALTRICS IDS
 * -------------
 * - SURVEY_ID: Your survey’s ID from Qualtrics (often visible in the survey URL
 *   or survey settings).
 * - DATA_CENTER: The part of your Qualtrics URL, e.g. `ca1`, `eu`, `b1` — it
 *   tells the API which regional cluster hosts your survey.
 */

window.VIBE_SURVEY_CONFIG = {
  /** Full URL of your proxy’s “accept submission” route (must be HTTPS in production). */
  PROXY_URL: 'https://qualtrics-vibe-proxy.onrender.com/submit-survey',

  /** Replace with your real Qualtrics survey ID before collecting real responses. */
  SURVEY_ID: 'SV_8iSPQ1rKeQSHXQa',

  /** Replace with your Qualtrics data center id (e.g. ca1, eu, b1). */
  DATA_CENTER: 'fra1',
};
