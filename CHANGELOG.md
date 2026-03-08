# Changelog

All notable changes to QuantFolio are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2025

### Added
- Initial release
- Twelve Data API integration with free-tier support
- 6 optimization strategies: Max Sharpe, Min Variance, Equal Weight, Max Return, Risk Parity, Sortino Focus
- Monte Carlo simulation (up to 30,000 portfolios)
- Efficient Frontier scatter chart
- Strategy weights bar chart
- Correlation matrix heatmap
- Capital growth projection chart
- Normalized price history chart
- Symbol search via Twelve Data symbol_search endpoint
- Indian stock support (`SYMBOL:NSE`, `SYMBOL:BSE`)
- Automatic rate-limit throttling between API calls
- API key persistence via localStorage
- 6 adjustable sliders: history window, simulations, risk-free rate, horizon, capital, max weight
- 5 quick presets: Tech, MAG-7, Balanced, ETF Mix, Finance
- Multi-file architecture: CSS tokens, components, results / JS api, quant, charts, main
- Tech Innovation × Midnight Galaxy theme
