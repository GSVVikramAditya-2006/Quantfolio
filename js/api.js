/**
 * api.js
 * Handles all Twelve Data API communication.
 * - Key management (save / restore from localStorage)
 * - Stock data fetching with rate-limit awareness
 * - Error classification with user-friendly messages
 */

'use strict';

/* ── Key state ──────────────────────────────────────────────────────────────── */
let API_KEY = '';
const STORAGE_KEY = 'qf_td_key';

/**
 * Save API key to memory and localStorage.
 * Updates the UI indicator on success.
 */
function saveApiKey() {
  const input = document.getElementById('keyInput');
  const k = input.value.trim();

  if (!k) {
    setKeyStatus('Please enter a key first', 'err');
    return;
  }

  API_KEY = k;

  try { localStorage.setItem(STORAGE_KEY, k); } catch (e) { /* localStorage unavailable */ }

  setKeyStatus('✓ Key saved: ' + k.slice(0, 8) + '...', 'ok');
  setApiIndicator(true);
}

/**
 * Restore saved key from localStorage on page load.
 */
function restoreApiKey() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      API_KEY = saved;
      document.getElementById('keyInput').value = saved;
      setKeyStatus('✓ Key loaded: ' + saved.slice(0, 8) + '...', 'ok');
      setApiIndicator(true);
    }
  } catch (e) { /* ignore */ }
}

/** Update the key status label */
function setKeyStatus(msg, cls = '') {
  const el = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className = 'key-status ' + cls;
}

/** Toggle the live indicator dot in the header */
function setApiIndicator(live) {
  document.getElementById('apiDot').classList.toggle('live', live);
  const lbl = document.getElementById('apiLabel');
  lbl.textContent = live ? 'TWELVE DATA CONNECTED' : 'API NOT CONFIGURED';
  if (live) lbl.style.color = 'var(--green)';
}

/* ── Symbol Search ──────────────────────────────────────────────────────────── */

/**
 * Search for a ticker by company name using Twelve Data symbol_search.
 * Renders clickable results into #searchResults.
 */
async function searchSymbol() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  if (!API_KEY) { document.getElementById('searchResults').textContent = '⚠ Save your API key first'; return; }

  const el = document.getElementById('searchResults');
  el.textContent = '⏳ Searching...';
  el.style.color = 'var(--muted)';

  try {
    const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      el.textContent = `No results found for "${q}"`;
      return;
    }

    const top = data.data.slice(0, 5);
    el.innerHTML = top.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border)">
        <span>
          <span style="color:var(--cyan)">${r.symbol}</span>
          <span style="color:var(--muted);margin-left:8px;font-size:0.58rem">${r.instrument_name} · ${r.exchange}</span>
        </span>
        <button onclick="addTicker('${r.symbol}')"
          style="background:rgba(0,255,255,0.07);border:1px solid rgba(0,255,255,0.2);color:var(--cyan);
                 padding:2px 8px;border-radius:4px;cursor:pointer;font-family:var(--font-mono);font-size:0.58rem">
          ADD
        </button>
      </div>`
    ).join('');

  } catch (e) {
    el.textContent = `Search error: ${e.message}`;
    el.style.color = 'var(--red)';
  }
}

/* ── Stock Data Fetch ───────────────────────────────────────────────────────── */

/**
 * Fetch daily historical price data for a single ticker.
 * Uses Twelve Data time_series endpoint.
 *
 * @param {string} ticker  - e.g. "AAPL" or "TCS:NSE"
 * @returns {object}       - { prices, dates, dailyReturns, annualRet, annualVol }
 * @throws {Error}         - User-facing error message on failure
 */
async function fetchStockData(ticker) {
  if (!API_KEY) throw new Error('No API key — save your Twelve Data key first');

  const yearsBack  = parseInt(document.getElementById('yrSlider').value);
  const outputsize = Math.min(yearsBack * 260, 5000); // ~260 trading days/year

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=${outputsize}&apikey=${API_KEY}`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Network error: ${e.message}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  console.log(`TwelveData [${ticker}]`, 'status:', data.status, '| points:', (data.values || []).length);

  /* ── Error classification ─────────────────────────────────────────────── */
  if (data.status === 'error') {
    if (data.code === 401) throw new Error('Invalid API key');
    if (data.code === 429) throw new Error('Rate limit hit — wait 60s and retry');

    if (data.code === 400 || data.code === 404) {
      // Indian stock hint
      const indianKeywords = ['NIFTY','SENSEX','NSE','BSE','RELIANCE','INFY','TCS','HDFC','SBIN','WIPRO','ICICI','BAJAJ','TATA'];
      const isIndian = indianKeywords.some(k => ticker.toUpperCase().includes(k));

      if (isIndian) {
        throw new Error(`Indian stocks need format SYMBOL:NSE — e.g. TCS:NSE or RELIANCE:NSE. May require a paid plan.`);
      }
      throw new Error(`"${ticker}" not found or requires a paid plan. Try the 🔍 symbol search.`);
    }

    throw new Error(`API error (${data.code}): ${data.message}`);
  }

  const values = data.values;
  if (!values || values.length < 20) throw new Error(`Too few data points returned for "${ticker}"`);

  // Twelve Data returns newest-first — reverse to chronological
  const sorted = [...values].reverse();

  const prices = sorted.map(v => parseFloat(v.close));
  const dates  = sorted.map(v => v.datetime);

  /* ── Compute statistics ───────────────────────────────────────────────── */
  const dailyReturns = [];
  for (let i = 1; i < prices.length; i++) {
    const r = Math.log(prices[i] / prices[i - 1]);
    if (isFinite(r)) dailyReturns.push(r);
  }

  const mean     = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length;

  return {
    prices,
    dates,
    dailyReturns,
    annualRet: mean * 252,
    annualVol: Math.sqrt(variance * 252),
  };
}
