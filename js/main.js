/**
 * main.js
 * UI controller and application orchestrator.
 *
 * Responsibilities:
 *  - Ticker tag management (add, remove, presets)
 *  - Slider label updates
 *  - Run pipeline: fetch → optimize → render
 *  - Rendering metrics, strategies, allocation bars
 *  - Tab switching
 *  - Status / loading overlay helpers
 */

'use strict';

/* ── App State ──────────────────────────────────────────────────────────────── */
let tickers   = [];
let stockData = {};

const RATE_LIMIT_DELAY = 8000; // ms between API calls (Twelve Data: 8 req/min free)

/* ── DOM Shortcuts ──────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── Slider Labels ──────────────────────────────────────────────────────────── */
function updateSliderLabel(sliderId, labelId, formatter) {
  $(labelId).textContent = formatter($( sliderId).value);
}

/* ── Ticker Management ──────────────────────────────────────────────────────── */

function addTicker(t) {
  const input = $('tickerInput');
  const raw   = (t || input.value).toUpperCase().trim();
  if (!raw) return;

  raw.split(/[,\s]+/).filter(Boolean).forEach(tk => {
    if (!tickers.includes(tk) && tickers.length < 12) tickers.push(tk);
  });

  if (!t) input.value = '';
  renderTags();
}

function removeTicker(t) {
  tickers = tickers.filter(x => x !== t);
  renderTags();
}

function setPreset(arr) {
  tickers = [...arr];
  renderTags();
}

function renderTags() {
  $('tags').innerHTML = tickers.map(t => `
    <div class="tag">
      ${t}
      <span class="remove" onclick="removeTicker('${t}')">×</span>
    </div>
  `).join('');
}

/* ── Run Pipeline ───────────────────────────────────────────────────────────── */

async function runAll() {
  if (tickers.length < 2) { alert('Add at least 2 tickers first.'); return; }
  if (!API_KEY)            { alert('Save your Twelve Data API key first.'); return; }

  const runBtn = $('runBtn');
  runBtn.disabled = true;
  runBtn.textContent = '⏳ FETCHING...';

  // Show results panel, hide empty state
  $('emptyState').classList.add('hidden');
  $('resultsSection').classList.remove('hidden');
  $('statusCard').classList.remove('hidden');
  $('statusList').innerHTML = '';

  showOverlay('FETCHING MARKET DATA', 'Calling Twelve Data API...');

  /* ── Fetch each ticker ──────────────────────────────────────────────── */
  const fetched = [];

  for (let i = 0; i < tickers.length; i++) {
    const tk = tickers[i];
    setStatus(tk, 'loading', 'fetching...');

    try {
      stockData[tk] = await fetchStockData(tk);
      fetched.push(tk);
      const d = stockData[tk];
      setStatus(tk, 'ok',
        `${(d.annualRet * 100).toFixed(1)}% ret · ${(d.annualVol * 100).toFixed(1)}% vol · ${d.dates.length} days`
      );
    } catch (e) {
      setStatus(tk, 'err', e.message);
    }

    // Rate limit: wait between calls (skip after last ticker)
    if (i < tickers.length - 1) {
      for (let s = RATE_LIMIT_DELAY / 1000; s >= 1; s--) {
        showOverlay('FETCHING MARKET DATA', `Rate limiting — next fetch in ${s}s...`);
        await sleep(1000);
      }
    }
  }

  if (fetched.length < 2) {
    hideOverlay();
    runBtn.disabled = false;
    runBtn.textContent = '⚡ FETCH DATA & OPTIMIZE';
    alert('Could not fetch enough data. Check your API key and tickers.');
    return;
  }

  showOverlay('RUNNING OPTIMIZATION', `Monte Carlo: ${parseInt($('mcSlider').value).toLocaleString()} simulations...`);
  await sleep(60);

  setTimeout(() => {
    try {
      optimizeAndRender(fetched);
    } finally {
      hideOverlay();
      runBtn.disabled = false;
      runBtn.textContent = '⚡ FETCH DATA & OPTIMIZE';
    }
  }, 60);
}

/* ── Optimize + Render ──────────────────────────────────────────────────────── */

function optimizeAndRender(tks) {
  const rfr      = parseFloat($('rfrSlider').value);
  const horizon  = parseInt($('hrzSlider').value);
  const capital  = parseInt($('capSlider').value);
  const maxW     = parseInt($('mwSlider').value);
  const simCount = parseInt($('mcSlider').value);

  const { sims, strategies, optimal, cov } = runOptimization(tks, stockData, { rfr, simCount, maxW });

  // Update date range label
  const firstDate = tks.reduce((d, t) => stockData[t].dates[0] < d ? stockData[t].dates[0] : d, '9999');
  const lastDate  = tks.reduce((d, t) => { const l = stockData[t].dates.slice(-1)[0]; return l > d ? l : d; }, '0000');
  $('dataRange').textContent = `${firstDate} → ${lastDate}`;

  // Render all panels
  renderMetrics(optimal, rfr);
  renderStrategies(strategies);
  renderAllocation(optimal, tks, capital, horizon);
  renderFrontier(sims, strategies);
  renderWeights(strategies, tks);
  renderCorr(tks, stockData);
  renderGrowth(strategies, capital, horizon);
  renderPrices(tks, stockData);
}

/* ── Metrics Panel ──────────────────────────────────────────────────────────── */

function renderMetrics(opt, rfr) {
  const sortino = opt.ret / (opt.vol * 0.65 + 1e-10);
  const maxDD   = opt.vol * 1.8;
  const cvar    = -(opt.ret - 2.33 * opt.vol);
  const calmar  = opt.ret / (maxDD + 1e-10);

  const metrics = [
    { label: 'Annual Return',  value: (opt.ret * 100).toFixed(1) + '%',  cls: opt.ret > 0 ? 'green' : 'red', highlight: true },
    { label: 'Volatility',     value: (opt.vol * 100).toFixed(1) + '%',  cls: 'amber' },
    { label: 'Sharpe Ratio',   value: opt.sharpe.toFixed(2),              cls: opt.sharpe > 1 ? 'green' : 'amber', highlight: true },
    { label: 'Sortino Ratio',  value: sortino.toFixed(2),                 cls: sortino > 1.5 ? 'green' : 'amber' },
    { label: 'Max Drawdown',   value: '-' + (maxDD * 100).toFixed(1) + '%', cls: 'red' },
    { label: 'CVaR (99%)',     value: (cvar * 100).toFixed(1) + '%',      cls: 'red' },
    { label: 'Calmar Ratio',   value: calmar.toFixed(2),                  cls: calmar > 0.5 ? 'green' : 'amber' },
    { label: 'Risk-Free Rate', value: rfr.toFixed(1) + '%',               cls: 'cyan' },
  ];

  $('metricsGrid').innerHTML = metrics.map(m => `
    <div class="metric-card ${m.highlight ? 'highlight' : ''}">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value ${m.cls}">${m.value}</div>
    </div>
  `).join('');
}

/* ── Strategy Cards ─────────────────────────────────────────────────────────── */

function renderStrategies(strategies) {
  $('strategyGrid').innerHTML = strategies.map(s => `
    <div class="strategy-card ${s.isOptimal ? 'optimal' : ''}">
      <div class="strategy-name">${s.name}</div>
      <div class="strategy-desc">${s.desc}</div>
      <div class="strategy-stats">
        <div class="stat">
          <div class="stat-label">RETURN</div>
          <div class="stat-value" style="color:var(--green)">${(s.ret * 100).toFixed(1)}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">RISK</div>
          <div class="stat-value" style="color:var(--red)">${(s.vol * 100).toFixed(1)}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">SHARPE</div>
          <div class="stat-value" style="color:var(--amber)">${s.sharpe.toFixed(2)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ── Allocation Bars + EV ───────────────────────────────────────────────────── */

function renderAllocation(opt, tks, capital, horizon) {
  $('allocCard').classList.remove('hidden');

  const ev = capital * Math.pow(1 + opt.ret, horizon);
  $('evValue').textContent = '$' + Math.round(ev).toLocaleString();
  $('evHorizon').textContent = horizon;
  $('evNote').textContent   = `Based on ${(opt.ret * 100).toFixed(1)}% annualized return from real data`;

  const colors = [
    '#00ffff','#ff3366','#ffb833','#a490c2',
    '#00e5a0','#ff9f43','#54a0ff','#ee5a24',
  ];

  const sorted = tks.map((t, i) => ({ t, w: opt.w[i] })).sort((a, b) => b.w - a.w);

  $('allocBars').innerHTML = sorted.map((item, i) => `
    <div class="alloc-bar-row">
      <div class="alloc-bar-header">
        <span class="alloc-ticker">${item.t}</span>
        <span class="alloc-pct">${(item.w * 100).toFixed(1)}%</span>
      </div>
      <div class="alloc-track">
        <div class="alloc-fill" style="width:${(item.w * 100).toFixed(1)}%;background:${colors[i % colors.length]}"></div>
      </div>
    </div>
  `).join('');
}

/* ── Tab Switching ──────────────────────────────────────────────────────────── */

function switchTab(name, el) {
  ['frontier','weights','corr','growth','prices'].forEach(t =>
    $('tab-' + t).classList.toggle('hidden', t !== name)
  );
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/* ── Status Helpers ─────────────────────────────────────────────────────────── */

function setStatus(ticker, state, note = '') {
  const list = $('statusList');
  let el = document.getElementById('st-' + ticker);

  if (!el) {
    el = document.createElement('div');
    el.className = 'status-item';
    el.id = 'st-' + ticker;
    list.appendChild(el);
  }

  const icon = state === 'ok' ? '✓' : state === 'err' ? '✗' : '···';
  el.innerHTML = `
    <span class="status-ticker">${ticker}</span>
    <span class="status-msg ${state}">${icon} ${note}</span>
  `;
}

function showOverlay(msg, sub = '') {
  $('loadingMsg').textContent = msg;
  $('loadingSub').textContent = sub;
  $('loadingOverlay').classList.add('visible');
}

function hideOverlay() {
  $('loadingOverlay').classList.remove('visible');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Init ───────────────────────────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  restoreApiKey();
  setPreset(['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META']);

  // Wire up Enter key for inputs
  $('tickerInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTicker(); });
  $('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchSymbol(); });
  $('keyInput').addEventListener('keydown',    e => { if (e.key === 'Enter') saveApiKey(); });
});
