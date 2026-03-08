/**
 * quant.js
 * All portfolio mathematics:
 * - Covariance / correlation matrices from real return data
 * - Portfolio return, volatility, Sharpe computation
 * - Random weight generation (Monte Carlo)
 * - Six optimization strategies
 */

'use strict';

/* ── Covariance Matrix ──────────────────────────────────────────────────────── */

/**
 * Build an annualized covariance matrix from daily log returns.
 * Aligns all return series to the shortest common length.
 *
 * @param {string[]} tickers
 * @param {object}   stockData  - { [ticker]: { dailyReturns: number[] } }
 * @returns {number[][]}        - n×n covariance matrix
 */
function buildCovMatrix(tickers, stockData) {
  const n       = tickers.length;
  const allRets = tickers.map(t => stockData[t].dailyReturns);
  const minLen  = Math.min(...allRets.map(r => r.length));

  // Use the most recent `minLen` observations (align tails)
  const aligned = allRets.map(r => r.slice(r.length - minLen));
  const means   = aligned.map(r => r.reduce((a, b) => a + b, 0) / r.length);

  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let sum = 0;
      for (let k = 0; k < minLen; k++) {
        sum += (aligned[i][k] - means[i]) * (aligned[j][k] - means[j]);
      }
      return (sum / minLen) * 252; // annualize
    })
  );
}

/**
 * Derive correlation matrix from covariance matrix.
 *
 * @param {string[]} tickers
 * @param {object}   stockData
 * @returns {number[][]}
 */
function buildCorrMatrix(tickers, stockData) {
  const cov = buildCovMatrix(tickers, stockData);
  const n   = tickers.length;

  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      cov[i][j] / (Math.sqrt(cov[i][i]) * Math.sqrt(cov[j][j]) + 1e-12)
    )
  );
}

/* ── Portfolio Statistics ───────────────────────────────────────────────────── */

/**
 * Compute portfolio return, volatility, and Sharpe ratio.
 *
 * @param {number[]} weights   - Asset weight vector (sums to 1)
 * @param {number[]} returns   - Annualized expected returns
 * @param {number[][]} cov     - Annualized covariance matrix
 * @param {number}   rfr      - Risk-free rate (%, e.g. 4.5)
 * @returns {{ ret, vol, sharpe }}
 */
function portfolioStats(weights, returns, cov, rfr) {
  const n = weights.length;

  // Weighted return
  const ret = weights.reduce((sum, w, i) => sum + w * returns[i], 0);

  // Portfolio variance: w^T * Σ * w
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * cov[i][j];
    }
  }

  const vol    = Math.sqrt(Math.max(0, variance));
  const sharpe = (ret - rfr / 100) / (vol + 1e-10);

  return { ret, vol, sharpe };
}

/* ── Random Weights ─────────────────────────────────────────────────────────── */

/**
 * Generate a random normalized weight vector respecting a max-weight cap.
 *
 * @param {number} n       - Number of assets
 * @param {number} maxPct  - Max weight per asset (0–100)
 * @returns {number[]}
 */
function randomWeights(n, maxPct) {
  let w = Array.from({ length: n }, () => Math.random());
  w = w.map(x => Math.min(x, (maxPct / 100) * n));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / total);
}

/* ── Six Optimization Strategies ───────────────────────────────────────────── */

/**
 * Run Monte Carlo simulation and compute all 6 strategies.
 *
 * @param {string[]} tickers
 * @param {object}   stockData
 * @param {object}   params    - { rfr, simCount, maxW }
 * @returns {{ sims, strategies, optimal }}
 */
function runOptimization(tickers, stockData, params) {
  const { rfr, simCount, maxW } = params;
  const n       = tickers.length;
  const returns = tickers.map(t => stockData[t].annualRet);
  const cov     = buildCovMatrix(tickers, stockData);
  const vols    = tickers.map(t => stockData[t].annualVol);

  /* ── Monte Carlo ────────────────────────────────────────────────────── */
  const sims = [];
  for (let i = 0; i < simCount; i++) {
    const w = randomWeights(n, maxW);
    sims.push({ w, ...portfolioStats(w, returns, cov, rfr) });
  }

  /* ── Strategy 1: Max Sharpe (best from MC) ─────────────────────────── */
  const maxSharpe = sims.reduce((best, s) => s.sharpe > best.sharpe ? s : best);

  /* ── Strategy 2: Min Variance (lowest vol from MC) ─────────────────── */
  const minVar = sims.reduce((best, s) => s.vol < best.vol ? s : best);

  /* ── Strategy 3: Max Return (highest return from MC) ───────────────── */
  const maxRet = sims.reduce((best, s) => s.ret > best.ret ? s : best);

  /* ── Strategy 4: Equal Weight (1/N) ────────────────────────────────── */
  const eqW = Array(n).fill(1 / n);

  /* ── Strategy 5: Risk Parity (inverse volatility) ──────────────────── */
  const invVol  = vols.map(v => 1 / v);
  const ivSum   = invVol.reduce((a, b) => a + b, 0);
  const rpW     = invVol.map(v => v / ivSum);

  /* ── Strategy 6: Sortino Focus (inverse vol²) ──────────────────────── */
  const invVol2 = vols.map(v => 1 / (v * v));
  const iv2Sum  = invVol2.reduce((a, b) => a + b, 0);
  const soW     = invVol2.map(v => v / iv2Sum);

  const strategies = [
    { name: 'Max Sharpe',    desc: 'Best risk-adjusted return.',        ...maxSharpe },
    { name: 'Min Variance',  desc: 'Lowest total portfolio volatility.', ...minVar },
    { name: 'Equal Weight',  desc: '1/N allocation across all assets.', w: eqW,  ...portfolioStats(eqW, returns, cov, rfr) },
    { name: 'Max Return',    desc: 'Highest expected annual return.',    ...maxRet },
    { name: 'Risk Parity',   desc: 'Equalizes risk contribution.',       w: rpW,  ...portfolioStats(rpW, returns, cov, rfr) },
    { name: 'Sortino Focus', desc: 'Minimises downside deviation.',      w: soW,  ...portfolioStats(soW, returns, cov, rfr) },
  ];

  // Tag the strategy with the highest Sharpe as optimal
  const bestIdx = strategies.reduce((bi, s, i) => s.sharpe > strategies[bi].sharpe ? i : bi, 0);
  strategies.forEach((s, i) => { s.isOptimal = i === bestIdx; });

  return { sims, strategies, optimal: strategies[bestIdx], cov };
}
