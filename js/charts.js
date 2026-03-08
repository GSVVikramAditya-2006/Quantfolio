/**
 * charts.js
 * All Chart.js rendering functions.
 * Each function destroys any existing chart before creating a new one.
 *
 * Charts:
 *  - renderFrontier   : Efficient frontier scatter plot
 *  - renderWeights    : Strategy weight comparison bar chart
 *  - renderCorr       : Correlation matrix heatmap (HTML table)
 *  - renderGrowth     : Capital growth projection line chart
 *  - renderPrices     : Normalized historical price chart
 */

'use strict';

/* ── Chart registry (track instances for destroy) ───────────────────────────── */
const chartInstances = {};

/* ── Shared defaults ────────────────────────────────────────────────────────── */
const CHART_COLORS = [
  '#00ffff','#ff3366','#ffb833','#a490c2',
  '#00e5a0','#ff9f43','#54a0ff','#ee5a24',
  '#0abde3','#c44569','#f9ca24','#5f27cd',
];

const GRID_COLOR = '#1d2140';
const TICK_STYLE = { color: '#525880', font: { family: 'JetBrains Mono', size: 9 } };
const LEGEND_STYLE = {
  labels: { color: '#525880', boxWidth: 10, font: { family: 'JetBrains Mono', size: 10 } }
};

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

/* ── 1. Efficient Frontier ──────────────────────────────────────────────────── */

/**
 * Scatter plot of all Monte Carlo portfolios colored by Sharpe ratio.
 * Strategy portfolios shown as large star markers.
 */
function renderFrontier(sims, strategies) {
  destroyChart('frontier');

  // Thin the sample for performance
  const step   = Math.max(1, Math.floor(sims.length / 1500));
  const sample = sims.filter((_, i) => i % step === 0);

  const minS = Math.min(...sample.map(p => p.sharpe));
  const maxS = Math.max(...sample.map(p => p.sharpe));

  const ctx = document.getElementById('frontierChart').getContext('2d');

  chartInstances.frontier = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Simulated Portfolios',
          data: sample.map(p => ({ x: p.vol * 100, y: p.ret * 100 })),
          backgroundColor: sample.map(p => {
            const t = (p.sharpe - minS) / (maxS - minS + 0.001);
            return `hsla(${170 + t * 55}, 100%, ${44 + t * 26}%, 0.42)`;
          }),
          pointRadius: 2,
        },
        // One dataset per strategy (star marker)
        ...strategies.map((s, i) => ({
          label: s.name,
          data: [{ x: s.vol * 100, y: s.ret * 100 }],
          backgroundColor: s.isOptimal ? '#ffb833' : CHART_COLORS[i],
          pointRadius: 11,
          pointStyle: 'star',
        })),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: LEGEND_STYLE,
        tooltip: {
          callbacks: {
            label: ctx =>
              ctx.datasetIndex === 0
                ? `Ret: ${ctx.parsed.y.toFixed(1)}%  Vol: ${ctx.parsed.x.toFixed(1)}%`
                : `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}% / ${ctx.parsed.x.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Risk (Volatility %)', color: '#525880', font: { family: 'JetBrains Mono', size: 10 } },
          ticks: TICK_STYLE,
          grid: { color: GRID_COLOR },
        },
        y: {
          title: { display: true, text: 'Expected Return %', color: '#525880', font: { family: 'JetBrains Mono', size: 10 } },
          ticks: TICK_STYLE,
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}

/* ── 2. Strategy Weights Bar Chart ──────────────────────────────────────────── */

function renderWeights(strategies, tickers) {
  destroyChart('weights');

  const ctx = document.getElementById('weightsChart').getContext('2d');

  chartInstances.weights = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tickers,
      datasets: strategies.map((s, i) => ({
        label: s.name,
        data: s.w.map(w => (w * 100).toFixed(1)),
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '88',
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: LEGEND_STYLE },
      scales: {
        x: { ticks: TICK_STYLE, grid: { color: GRID_COLOR } },
        y: {
          title: { display: true, text: 'Weight %', color: '#525880', font: { family: 'JetBrains Mono', size: 10 } },
          ticks: TICK_STYLE,
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}

/* ── 3. Correlation Matrix Heatmap ──────────────────────────────────────────── */

function renderCorr(tickers, stockData) {
  const corr = buildCorrMatrix(tickers, stockData);
  const n    = tickers.length;

  let html = `<table class="corr-table">
    <thead><tr><th></th>${tickers.map(t => `<th>${t}</th>`).join('')}</tr></thead>
    <tbody>`;

  for (let i = 0; i < n; i++) {
    html += `<tr><th style="color:var(--cyan)">${tickers[i]}</th>`;
    for (let j = 0; j < n; j++) {
      const v = corr[i][j];
      let bg, color;

      if (i === j) {
        bg = 'rgba(0,255,255,0.18)'; color = 'var(--cyan)';
      } else if (v > 0) {
        bg = `rgba(255,51,102,${Math.abs(v) * 0.6})`;
        color = Math.abs(v) > 0.5 ? '#fff' : 'var(--text)';
      } else {
        bg = `rgba(0,229,160,${Math.abs(v) * 0.6})`;
        color = Math.abs(v) > 0.4 ? 'var(--base)' : 'var(--text)';
      }

      html += `<td style="background:${bg};color:${color}">${v.toFixed(2)}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  document.getElementById('corrContainer').innerHTML = html;
}

/* ── 4. Capital Growth Projection ───────────────────────────────────────────── */

function renderGrowth(strategies, capital, horizon) {
  destroyChart('growth');

  const years = Array.from({ length: horizon + 1 }, (_, i) => i);
  const ctx   = document.getElementById('growthChart').getContext('2d');

  chartInstances.growth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years.map(y => 'Yr ' + y),
      datasets: strategies.map((s, i) => ({
        label: s.name,
        data: years.map(y => Math.round(capital * Math.pow(1 + s.ret, y))),
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: 'transparent',
        borderWidth: s.isOptimal ? 3 : 1.5,
        borderDash: s.isOptimal ? [] : [5, 4],
        pointRadius: 0,
        tension: 0.4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: LEGEND_STYLE,
        tooltip: {
          callbacks: { label: c => `${c.dataset.label}: $${c.parsed.y.toLocaleString()}` },
        },
      },
      scales: {
        x: { ticks: TICK_STYLE, grid: { color: GRID_COLOR } },
        y: {
          ticks: { ...TICK_STYLE, callback: v => '$' + v.toLocaleString() },
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}

/* ── 5. Normalized Price History ────────────────────────────────────────────── */

function renderPrices(tickers, stockData) {
  destroyChart('prices');

  // Thin date labels
  const allDates = stockData[tickers[0]].dates;
  const step     = Math.max(1, Math.floor(allDates.length / 10));

  const ctx = document.getElementById('pricesChart').getContext('2d');

  chartInstances.prices = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allDates.map((d, i) => i % step === 0 ? d : ''),
      datasets: tickers.map((tk, i) => {
        const prices = stockData[tk].prices;
        const base   = prices[0];
        return {
          label: tk,
          data: prices.map(p => +((p / base * 100).toFixed(2))),
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: LEGEND_STYLE,
        tooltip: {
          callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(1)}` },
        },
      },
      scales: {
        x: { ticks: { ...TICK_STYLE, maxRotation: 30 }, grid: { color: GRID_COLOR } },
        y: {
          title: { display: true, text: 'Normalized (Base = 100)', color: '#525880', font: { family: 'JetBrains Mono', size: 9 } },
          ticks: TICK_STYLE,
          grid: { color: GRID_COLOR },
        },
      },
    },
  });
}
