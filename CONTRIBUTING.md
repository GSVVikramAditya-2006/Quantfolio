# Contributing to QuantFolio

Thanks for your interest in contributing! Here's how to get involved.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/quantfolio.git
   cd quantfolio
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Project Structure

| File | What to edit here |
|---|---|
| `css/theme.css` | Colors, fonts, spacing tokens |
| `css/components.css` | Buttons, inputs, cards, sliders |
| `css/results.css` | Charts, metrics, allocation bars |
| `js/api.js` | API provider, fetch logic, error handling |
| `js/quant.js` | Portfolio math, new strategies |
| `js/charts.js` | New chart types or chart options |
| `js/main.js` | UI flow, new controls, rendering |

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Black-Litterman optimization strategy
fix: handle missing data points in covariance matrix
style: tighten spacing on metric cards
docs: update API key setup instructions
refactor: split quant.js into math and strategies
```

## Good First Issues

- Add a new optimization strategy in `js/quant.js`
- Support a new data provider in `js/api.js`
- Add a new chart tab in `js/charts.js` + `index.html`
- Improve mobile layout in `css/base.css`

## Pull Request Checklist

- [ ] Tested in Chrome and Firefox
- [ ] No API keys or secrets committed
- [ ] Code follows the existing comment style
- [ ] README updated if new features added

## Code Style

- 2-space indentation
- JSDocs for all exported functions
- Section comments use the `/* ── Title ─── */` format
- No external dependencies beyond Chart.js

## Questions?

Open a GitHub Discussion or Issue.
