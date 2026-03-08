# 📈 QuantFolio — Portfolio Optimization Engine

A browser-based quantitative portfolio optimizer that fetches real historical market data and applies classical portfolio theory to find the best risk-vs-return allocation across your selected stocks.

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey.svg)
![HTML](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-orange.svg)
![No Build](https://img.shields.io/badge/build-none%20required-brightgreen.svg)
![Data](https://img.shields.io/badge/data-Twelve%20Data%20API-blueviolet.svg)

---

## ✨ Features

- **Real market data** via Twelve Data API (free tier supported)
- **6 optimization strategies** — Max Sharpe, Min Variance, Equal Weight, Max Return, Risk Parity, Sortino Focus
- **Monte Carlo simulation** — up to 30,000 random portfolios sampled
- **Efficient Frontier** scatter plot with Sharpe-colored points
- **5 analysis tabs** — Frontier · Weights · Correlation · Growth · Prices
- **Adjustable parameters** — history window, simulations, risk-free rate, horizon, capital, max weight cap
- **Symbol search** — look up any ticker by company name
- **Indian stock support** — `SYMBOL:NSE` / `SYMBOL:BSE` format
- **No build step** — plain HTML/CSS/JS, open directly in browser

---

## 📁 Project Structure

```
quantfolio/
├── index.html              ← Entry point (markup only)
├── css/
│   ├── theme.css           ← Design tokens & CSS variables
│   ├── base.css            ← Reset, body, layout
│   ├── components.css      ← Cards, buttons, inputs, sliders, tabs
│   └── results.css         ← Metrics, charts, overlay, allocation bars
└── js/
    ├── api.js              ← Twelve Data API, key management, symbol search
    ├── quant.js            ← Covariance matrix, portfolio math, 6 strategies
    ├── charts.js           ← All Chart.js rendering
    └── main.js             ← UI controller, run pipeline, DOM wiring
```

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/quantfolio.git
cd quantfolio
```

### 2. Get a free API key

1. Go to [twelvedata.com](https://twelvedata.com) → **Get API Key**
2. Sign up free — key shown instantly, no credit card needed
3. Free tier: **800 req/day · 8 req/min**

### 3. Open in browser

```bash
# Option A — just double-click index.html

# Option B — local server (recommended)
python -m http.server 8080
# open http://localhost:8080
```

### 4. Run the app

1. Paste your API key → **SAVE**
2. Add tickers or pick a preset
3. Adjust sliders to your preferences
4. Click **⚡ FETCH DATA & OPTIMIZE**

---

## 📊 How It Works

### Optimization Pipeline

```
Tickers selected by user
        ↓
Twelve Data API → daily closing prices (up to 20 years)
        ↓
Daily log returns + annualized covariance matrix
        ↓
Monte Carlo: N random weight vectors sampled
        ↓
Per portfolio:  E[R] = Σ wᵢμᵢ
                σ²   = wᵀΣw
                SR   = (E[R] − Rf) / σ
        ↓
6 named strategies computed
        ↓
★ Optimal = highest Sharpe Ratio
```

### Metrics

| Metric | Description |
|---|---|
| Annual Return | Annualized expected portfolio return |
| Volatility | Annualized standard deviation |
| Sharpe Ratio | Risk-adjusted return vs risk-free rate |
| Sortino Ratio | Downside-only risk measure |
| Max Drawdown | Estimated peak-to-trough loss |
| CVaR (99%) | Conditional Value at Risk |
| Calmar Ratio | Return / Max Drawdown |

---

## 🌍 Supported Markets

| Market | Format | Example | Free Tier |
|---|---|---|---|
| US Stocks (NYSE/NASDAQ) | `SYMBOL` | `AAPL`, `MSFT` | ✅ |
| Indian Stocks (NSE) | `SYMBOL:NSE` | `TCS:NSE`, `RELIANCE:NSE` | ⚠️ May need paid |
| Indian Stocks (BSE) | `SYMBOL:BSE` | `INFY:BSE` | ⚠️ May need paid |
| ETFs | `SYMBOL` | `SPY`, `QQQ`, `GLD` | ✅ |

> Use the **🔍 Symbol Lookup** to find the correct symbol for any company.

---

## ⚠️ Known Limitations

- Some tickers require a Twelve Data paid plan (you'll see a 404 error)
- The app waits **8 seconds between fetches** to respect the free rate limit
- Growth projections assume constant annualized return (simplified model)
- All computation runs client-side — no backend, no data stored

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML5 / CSS3 / JavaScript (ES2020) |
| Charts | Chart.js 4.4 |
| Fonts | Space Grotesk + JetBrains Mono (Google Fonts) |
| Data | Twelve Data API |
| Build | None — zero dependencies, zero bundler |

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
git commit -m "feat: description"
git push origin feature/your-feature
```

PRs welcome. Open an issue first for major changes.

---

## 📄 License

CC BY-NC 4.0 — see [LICENSE](LICENSE) for details.

Free to use and adapt with attribution. Commercial use is not permitted.

---

## 🙏 Acknowledgements

- Portfolio theory: Harry Markowitz, *Portfolio Selection* (1952)
- Market data: [Twelve Data](https://twelvedata.com)
- Charts: [Chart.js](https://www.chartjs.org)
